from flask import render_template, redirect, request, session, url_for, jsonify
from bson import ObjectId
import datetime
import os
import random
import string
import secrets

def register_routes(app, deps):
    users = deps.get("users")
    proposals = deps.get("proposals")
    preferences = deps.get("preferences")
    proposal_links = deps.get("proposal_links")
    business_analytics = deps.get("business_analytics")
    submissions = deps.get("submissions")

    # ==================== BUSINESS ROUTES ====================
    @app.route("/dashboard/business")
    def dashboard_business():
        if "user_id" not in session or session.get("role") != "business":
            return redirect(url_for("login"))
        
        user_id = ObjectId(session["user_id"])
        user = users.find_one({"_id": user_id})
        
        # Get business's proposal requests (created by business)
        business_proposals = list(proposals.find({"business_id": user_id}).sort("created_at", -1))
        
        # Get submissions from service providers to this business
        business_submissions = list(submissions.find({"business_id": user_id}).sort("created_at", -1))
        
        analytics_data = get_business_analytics(user_id)
        user_preferences = preferences.find_one({"user_id": user_id}) or {}
        
        return render_template("dashboard-business.html", 
                             fullname=session["fullname"],
                             user=user,
                             proposals=business_proposals,
                             submissions=business_submissions,
                             analytics=analytics_data,
                             preferences=user_preferences)

    # ==================== SUBMISSIONS ROUTES ====================

    @app.route("/api/submissions")
    def api_submissions():
        """Get submissions from service providers for the business"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        try:
            category = request.args.get('category')
            query = {"business_id": user_id}
            if category:
                query["category"] = category
                
            # Get submissions from submissions collection
            business_submissions = list(submissions.find(query).sort("created_at", -1))
            
            # Convert ObjectId to string for JSON serialization
            for submission in business_submissions:
                submission["_id"] = str(submission["_id"])
                submission["business_id"] = str(submission["business_id"])
                
            return jsonify({"status": "success", "submissions": business_submissions})
            
        except Exception as e:
            print(f"Error getting submissions: {str(e)}")
            return jsonify({"status": "error", "msg": f"Error getting submissions: {str(e)}"}), 500

    @app.route("/api/submissions/<submission_id>")
    def api_get_submission(submission_id):
        """Get specific submission details"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        try:
            submission = submissions.find_one({"_id": ObjectId(submission_id), "business_id": user_id})
            if not submission:
                return jsonify({"status": "error", "msg": "Submission not found"}), 404
            
            # Convert ObjectId to string for JSON serialization
            submission["_id"] = str(submission["_id"])
            submission["business_id"] = str(submission["business_id"])
            
            return jsonify({"status": "success", "submission": submission})
            
        except Exception as e:
            return jsonify({"status": "error", "msg": f"Error fetching submission: {str(e)}"}), 500

    @app.route("/api/submissions/<submission_id>/decline", methods=["POST"])
    def api_decline_submission(submission_id):
        """Decline and DELETE a submission"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        try:
            # DELETE the submission instead of updating status
            result = submissions.delete_one(
                {"_id": ObjectId(submission_id), "business_id": user_id}
            )
            
            if result.deleted_count > 0:
                update_business_analytics(user_id)
                return jsonify({"status": "success", "msg": "Submission declined and removed successfully"})
            else:
                return jsonify({"status": "error", "msg": "Submission not found"}), 404
                
        except Exception as e:
            return jsonify({"status": "error", "msg": f"Error declining submission: {str(e)}"}), 500

    # ==================== PROPOSAL REQUESTS ROUTES ====================

    @app.route("/api/proposal-requests", methods=["GET", "POST"])
    def api_proposal_requests():
        """Handle business proposal requests (created by business)"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        if request.method == "GET":
            try:
                # Get proposal requests created by the business
                business_proposals = list(proposals.find({"business_id": user_id}).sort("created_at", -1))
                
                # Enhance with submission counts
                formatted_proposals = []
                for proposal in business_proposals:
                    # Count submissions for this proposal request
                    submission_count = submissions.count_documents({
                        "proposal_request_id": proposal["_id"]
                    })
                    
                    formatted_proposal = {
                        "_id": str(proposal["_id"]),
                        "business_id": str(proposal["business_id"]),
                        "title": proposal.get("title", "Untitled Request"),
                        "category": proposal.get("category", "Uncategorized"),
                        "description": proposal.get("description", ""),
                        "budget_range": proposal.get("budget_range", "Not specified"),
                        "timeline": proposal.get("timeline", ""),
                        "requirements": proposal.get("requirements", ""),
                        "status": proposal.get("status", "active"),
                        "submission_count": submission_count,
                        "share_link": get_or_create_share_link(user_id, proposal["_id"]),
                        "created_at": proposal.get("created_at"),
                        "updated_at": proposal.get("updated_at")
                    }
                    formatted_proposals.append(formatted_proposal)
                
                return jsonify({"status": "success", "proposal_requests": formatted_proposals})
                
            except Exception as e:
                print(f"Error getting proposal requests: {str(e)}")
                return jsonify({"status": "error", "msg": f"Error getting proposal requests: {str(e)}"}), 500
        
        elif request.method == "POST":
            try:
                data = request.get_json()
                
                proposal_data = {
                    "business_id": user_id,
                    "title": data.get("title"),
                    "category": data.get("category"),
                    "description": data.get("description"),
                    "budget_range": data.get("budget_range"),
                    "timeline": data.get("timeline"),
                    "requirements": data.get("requirements", ""),
                    "status": "active",
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow()
                }
                
                result = proposals.insert_one(proposal_data)
                update_business_analytics(user_id)
                
                return jsonify({
                    "status": "success", 
                    "msg": "Proposal request created successfully",
                    "proposal_id": str(result.inserted_id)
                })
                
            except Exception as e:
                return jsonify({"status": "error", "msg": f"Error creating proposal request: {str(e)}"}), 500

    @app.route("/api/proposal-requests/<proposal_id>", methods=["DELETE"])
    def api_delete_proposal_request(proposal_id):
        """Delete a proposal request"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        try:
            result = proposals.delete_one({"_id": ObjectId(proposal_id), "business_id": user_id})
            
            if result.deleted_count > 0:
                update_business_analytics(user_id)
                return jsonify({"status": "success", "msg": "Proposal request deleted successfully"})
            else:
                return jsonify({"status": "error", "msg": "Proposal request not found"}), 404
                
        except Exception as e:
            return jsonify({"status": "error", "msg": f"Error deleting proposal request: {str(e)}"}), 500

    @app.route("/api/proposal-requests/<proposal_id>/submissions")
    def api_get_request_submissions(proposal_id):
        """Get submissions for a specific proposal request"""
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        try:
            # Verify the proposal request belongs to this business
            proposal = proposals.find_one({"_id": ObjectId(proposal_id), "business_id": user_id})
            if not proposal:
                return jsonify({"status": "error", "msg": "Proposal request not found"}), 404
            
            # Get submissions for this proposal request
            request_submissions = list(submissions.find({
                "proposal_request_id": ObjectId(proposal_id)
            }).sort("created_at", -1))
            
            # Convert ObjectId to string
            for submission in request_submissions:
                submission["_id"] = str(submission["_id"])
                submission["business_id"] = str(submission["business_id"])
                if "proposal_request_id" in submission:
                    submission["proposal_request_id"] = str(submission["proposal_request_id"])
                
            return jsonify({"status": "success", "submissions": request_submissions})
            
        except Exception as e:
            return jsonify({"status": "error", "msg": f"Error fetching submissions: {str(e)}"}), 500

    # ==================== ANALYTICS & PREFERENCES ROUTES ====================

    @app.route("/api/analytics/business")
    def api_business_analytics():
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        analytics_data = get_business_analytics(user_id)
        return jsonify({"status": "success", "analytics": analytics_data})

    @app.route("/api/preferences", methods=["GET", "PUT"])
    def api_preferences():
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        if request.method == "GET":
            user_preferences = preferences.find_one({"user_id": user_id})
            if user_preferences:
                user_preferences["_id"] = str(user_preferences["_id"])
                user_preferences["user_id"] = str(user_preferences["user_id"])
            return jsonify({"status": "success", "preferences": user_preferences or {}})
        
        elif request.method == "PUT":
            try:
                data = request.get_json()
                
                preference_data = {
                    "user_id": user_id,
                    "categories": data.get("categories", []),
                    "budget_min": data.get("budget_min", 5000),
                    "budget_max": data.get("budget_max", 50000),
                    "technologies": data.get("technologies", []),
                    "project_scope": data.get("project_scope", ""),
                    "match_threshold": data.get("match_threshold", 80),
                    "updated_at": datetime.datetime.utcnow()
                }
                
                # Upsert preferences
                result = preferences.update_one(
                    {"user_id": user_id},
                    {"$set": preference_data},
                    upsert=True
                )
                
                # Generate/update share link when preferences are saved
                generate_share_link(user_id)
                
                return jsonify({"status": "success", "msg": "Preferences saved successfully"})
                
            except Exception as e:
                return jsonify({"status": "error", "msg": f"Error saving preferences: {str(e)}"}), 500

    @app.route("/api/share-link", methods=["GET"])
    def api_share_link():
        if "user_id" not in session or session.get("role") != "business":
            return jsonify({"status": "error", "msg": "Unauthorized"}), 401
        
        user_id = ObjectId(session["user_id"])
        
        proposal_id = request.args.get("proposal_id")
        share_link = get_or_create_share_link(user_id, proposal_id)
        return jsonify({"status": "success", "share_link": share_link})

    # ==================== PROPOSAL SUBMISSION ROUTE ====================

    @app.route("/submit/<slug>", methods=["GET", "POST"])
    def submit_proposal(slug):
        if request.method == "GET":
            # Get business details from slug
            link_data = proposal_links.find_one({"slug": slug, "is_active": True})
            if not link_data:
                return render_template("404.html"), 404
            
            business = users.find_one({"_id": link_data["user_id"]})
            business_prefs = preferences.find_one({"user_id": link_data["user_id"]}) or {}
            
            return render_template("submit-proposal.html",
                                business_name=business.get("fullname", "Business"),
                                preferences=business_prefs,
                                slug=slug)
        
        elif request.method == "POST":
            try:
                # Verify slug exists and is active
                link_data = proposal_links.find_one({"slug": slug, "is_active": True})
                if not link_data:
                    return jsonify({"status": "error", "msg": "Invalid submission link"}), 404
                
                data = request.get_json()
                
                # Calculate match score based on preferences
                match_score = calculate_match_score(link_data["user_id"], data)
                proposal_request_id = request.args.get("proposal_id")
                proposal_request_object_id = None
                if proposal_request_id:
                    try:
                        candidate_id = ObjectId(proposal_request_id)
                        proposal_exists = proposals.find_one({
                            "_id": candidate_id,
                            "business_id": link_data["user_id"]
                        })
                        if proposal_exists:
                            proposal_request_object_id = candidate_id
                    except Exception:
                        proposal_request_object_id = None
                
                # Save to SUBMISSIONS collection (not proposals)
                submission_data = {
                    "business_id": link_data["user_id"],
                    "submitter_name": data.get("submitter_name"),
                    "submitter_email": data.get("submitter_email"),
                    "company_name": data.get("company_name"),
                    "title": data.get("title"),
                    "category": data.get("category"),
                    "description": data.get("description"),
                    "budget_range": data.get("budget_range", data.get("budget", "Not specified")),
                    "timeline": data.get("timeline"),
                    "technologies": data.get("technologies", []),
                    "experience": data.get("experience"),
                    "portfolio_url": data.get("portfolio_url", ""),
                    "status": "pending",
                    "match_score": match_score,
                    "submitted_via_slug": slug,
                    "created_at": datetime.datetime.utcnow(),
                    "updated_at": datetime.datetime.utcnow()
                }
                if proposal_request_object_id:
                    submission_data["proposal_request_id"] = proposal_request_object_id
                
                result = submissions.insert_one(submission_data)
                update_business_analytics(link_data["user_id"])
                
                return jsonify({
                    "status": "success", 
                    "msg": "Proposal submitted successfully!",
                    "submission_id": str(result.inserted_id),
                    "match_score": match_score
                })
                
            except Exception as e:
                return jsonify({"status": "error", "msg": f"Error submitting proposal: {str(e)}"}), 500

    # ==================== HELPER FUNCTIONS ====================

    def get_business_analytics(user_id):
        try:
            # Count proposal requests (created by business)
            total_requests = proposals.count_documents({"business_id": user_id})
            active_requests = proposals.count_documents({"business_id": user_id, "status": "active"})
            
            # Count submissions (from service providers)
            total_submissions = submissions.count_documents({"business_id": user_id})
            high_match_submissions = submissions.count_documents({
                "business_id": user_id,
                "match_score": {"$gte": 80}
            })
            pending_review = submissions.count_documents({
                "business_id": user_id,
                "status": "pending"
            })
            
            # Calculate average match rate from submissions
            business_submissions = list(submissions.find({"business_id": user_id}))
            if business_submissions:
                total_match_score = sum(sub.get('match_score', 0) for sub in business_submissions)
                avg_match_rate = round(total_match_score / len(business_submissions))
            else:
                avg_match_rate = 0

            category_breakdown = []
            for row in submissions.aggregate([
                {"$match": {"business_id": user_id}},
                {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]):
                category_breakdown.append({
                    "label": row.get("_id") or "Uncategorized",
                    "count": row.get("count", 0)
                })

            match_distribution = [
                {"label": "80-100", "count": submissions.count_documents({"business_id": user_id, "match_score": {"$gte": 80}})},
                {"label": "60-79", "count": submissions.count_documents({"business_id": user_id, "match_score": {"$gte": 60, "$lt": 80}})},
                {"label": "0-59", "count": submissions.count_documents({"business_id": user_id, "match_score": {"$lt": 60}})}
            ]

            review_rate = round((high_match_submissions / total_submissions) * 100) if total_submissions else 0
            
            return {
                "total_requests": total_requests,
                "active_requests": active_requests,
                "total_submissions": total_submissions,
                "high_match_submissions": high_match_submissions,
                "pending_review": pending_review,
                "avg_match_rate": avg_match_rate,
                "review_rate": review_rate,
                "category_breakdown": category_breakdown,
                "match_distribution": match_distribution
            }
            
        except Exception as e:
            print(f"Error in get_business_analytics: {str(e)}")
            return {
                "total_requests": 0,
                "active_requests": 0,
                "total_submissions": 0,
                "high_match_submissions": 0,
                "pending_review": 0,
                "avg_match_rate": 0,
                "review_rate": 0,
                "category_breakdown": [],
                "match_distribution": []
            }

    def update_business_analytics(user_id):
        analytics_data = get_business_analytics(user_id)
        business_analytics.update_one(
            {"user_id": user_id},
            {"$set": analytics_data},
            upsert=True
        )

    def generate_share_link(user_id):
        # Generate unique slug
        alphabet = string.ascii_letters + string.digits
        slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Ensure uniqueness
        while proposal_links.find_one({"slug": slug}):
            slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        share_link_data = {
            "user_id": user_id,
            "slug": slug,
            "is_active": True,
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        
        # Upsert share link
        proposal_links.update_one(
            {"user_id": user_id},
            {"$set": share_link_data},
            upsert=True
        )
        
        return build_share_url(slug)

    def get_or_create_share_link(user_id, proposal_id=None):
        existing_link = proposal_links.find_one({"user_id": user_id, "is_active": True})
        if existing_link:
            return build_share_url(existing_link["slug"], proposal_id)
        else:
            slug = generate_share_link(user_id).rsplit("/", 1)[-1]
            return build_share_url(slug, proposal_id)

    def build_share_url(slug, proposal_id=None):
        base_url = os.environ.get("SHARE_BASE_URL") or os.environ.get("PUBLIC_BASE_URL") or request.host_url
        base_url = base_url.rstrip("/")
        share_url = f"{base_url}/submit/{slug}"
        if proposal_id:
            share_url = f"{share_url}?proposal_id={str(proposal_id)}"
        return share_url

    def calculate_match_score(user_id, submission_data):
        # Get business preferences
        business_prefs = preferences.find_one({"user_id": user_id}) or {}
        
        base_score = random.randint(70, 95)
        
        # Add bonus points for category match
        if submission_data.get("category") in business_prefs.get("categories", []):
            base_score += 10
        
        # Add bonus points for technology stack match
        submission_techs = submission_data.get("technologies", [])
        preferred_techs = business_prefs.get("technologies", [])
        tech_matches = set(submission_techs) & set(preferred_techs)
        if tech_matches:
            base_score += min(len(tech_matches) * 5, 15)
        
        return min(base_score, 100)
