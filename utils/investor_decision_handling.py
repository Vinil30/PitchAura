# utils/investor_decisions.py

from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Literal
from utils.db_connect import investor_ent_matches, investor_maybe, investor_rejections, investor_feed_blocker, summaries, investor_feed, pitches
from bson import ObjectId
import datetime


# ------------------------- Safe ObjectId Converter -------------------------
def safe_objectid(id_value):
    """Safely convert to ObjectId if valid 24-char hex string, else return as-is."""
    if isinstance(id_value, ObjectId):
        return id_value
    if isinstance(id_value, str) and len(id_value) == 24:
        try:
            return ObjectId(id_value)
        except Exception:
            return id_value
    return id_value


# ------------------------- Agent State Definition -------------------------
class AgentState(TypedDict):
    investor_id: str
    entrepreneur_id: str
    pitch_id: str
    decision: Literal["matched", "maybe", "rejected"]
    timestamp: str


# ------------------------- Router Function -------------------------
def router(state: AgentState) -> AgentState:
    """Route based on investor decision - MUST return state dict"""
    print(f"🔄 Routing decision: {state['decision']}")
    # Return the state unchanged - conditional edges handle the routing
    return state

# ------------------------- Handlers for Each Decision -------------------------
def handle_matched(state: AgentState) -> AgentState:
    """Handle matched investments - add to matches collection"""
    try:
        print(f"✅ Adding to matches: Investor {state['investor_id']} → Entrepreneur {state['entrepreneur_id']}")

        # Keep IDs as strings - don't convert to ObjectId
        investor_id = state["investor_id"]
        entrepreneur_id = state["entrepreneur_id"]
        pitch_id = state["pitch_id"]

        investor_ent_matches.update_one(
            {
                "investor_id": investor_id,
                "entrepreneur_id": entrepreneur_id
            },
            {
                "$set": {
                    "pitch_id": pitch_id,
                    "decision": "matched",
                    "timestamp": datetime.datetime.utcnow(),
                    "status": "active"
                }
            },
            upsert=True
        )
        try:
            pitches.update_one(
                {"_id": safe_objectid(pitch_id)},
                {"$set": {"status": "matched", "updated_at": datetime.datetime.utcnow()}}
            )
        except Exception as pitch_error:
            print(f"Could not update pitch matched status: {pitch_error}")


        print("✅ Successfully added to matches collection")
        return state

    except Exception as e:
        print(f"❌ Error in handle_matched: {e}")
        return state


def handle_maybe(state: AgentState) -> AgentState:
    """Handle maybe decisions - add to maybe collection"""
    try:
        print(f"🤔 Adding to maybe: Investor {state['investor_id']} → Entrepreneur {state['entrepreneur_id']}")

        # Keep IDs as strings
        investor_id = state["investor_id"]
        entrepreneur_id = state["entrepreneur_id"]
        pitch_id = state["pitch_id"]

        investor_maybe.update_one(
            {
                "investor_id": investor_id,
                "entrepreneur_id": entrepreneur_id
            },
            {
                "$set": {
                    "pitch_id": pitch_id,
                    "decision": "maybe",
                    "timestamp": datetime.datetime.utcnow(),
                    "status": "pending_review"
                }
            },
            upsert=True
        )

        print("✅ Successfully added to maybe collection")
        return state

    except Exception as e:
        print(f"❌ Error in handle_maybe: {e}")
        return state


def handle_rejected(state: AgentState) -> AgentState:
    """Handle rejected investments - add to rejections collection"""
    try:
        print(f"❌ Adding to rejections: Investor {state['investor_id']} → Entrepreneur {state['entrepreneur_id']}")

        # Keep IDs as strings
        investor_id = state["investor_id"]
        entrepreneur_id = state["entrepreneur_id"]
        pitch_id = state["pitch_id"]

        investor_rejections.update_one(
            {
                "investor_id": investor_id,
                "entrepreneur_id": entrepreneur_id
            },
            {
                "$set": {
                    "pitch_id": pitch_id,
                    "decision": "rejected",
                    "timestamp": datetime.datetime.utcnow(),
                    "reason": "investor_declined",
                    "status": "closed"
                }
            },
            upsert=True
        )

        print("✅ Successfully added to rejections collection")
        return state

    except Exception as e:
        print(f"❌ Error in handle_rejected: {e}")
        return state

def delete_from_feed(state: AgentState) -> AgentState:
    """Remove the pitch from investor_feed after decision"""
    try:
        print(f"🗑️ Removing pitch {state['pitch_id']} from investor feed")
        
        investor_id = state["investor_id"]
        pitch_id = state["pitch_id"]
        
        # Remove the specific pitch from investor_feed matches
        result = investor_feed.update_one(
            {"investor_id": investor_id},
            {
                "$pull": {
                    "matches": {"pitch_id": pitch_id}
                }
            }
        )
        
        if result.modified_count > 0:
            print(f"✅ Successfully removed pitch {pitch_id} from feed")
        else:
            print(f"ℹ️ Pitch {pitch_id} not found in feed or already removed")
            
        return state
        
    except Exception as e:
        print(f"❌ Error deleting from feed: {e}")
        return state

def provide_clear_summary(state: AgentState) -> AgentState:
    """Generate and store a summary for 'maybe' decisions"""
    try:
        print(f"📝 Generating summary for pitch {state['pitch_id']} (maybe decision)")
        
        investor_id = state["investor_id"]
        entrepreneur_id = state["entrepreneur_id"]
        pitch_id = state["pitch_id"]
        decision = state["decision"]
        
        # Get pitch details for better summary
        pitch_title = "Untitled Pitch"
        pitch_description = "No description available"
        
        try:
            # Try both ObjectId and string lookup
            pitch = pitches.find_one({"_id": ObjectId(pitch_id)})
            if not pitch:
                pitch = pitches.find_one({"_id": pitch_id})
            
            if pitch:
                pitch_title = pitch.get("title", "Untitled Pitch")
                pitch_description = pitch.get("description", pitch.get("elevator_pitch", "No description available"))
        except Exception as e:
            print(f"⚠️ Could not fetch pitch details: {e}")
        
        # Create a comprehensive summary document with ALL required fields
        summary_data = {
            "investor_id": investor_id,
            "entrepreneur_id": entrepreneur_id,
            "pitch_id": pitch_id,
            "pitch_title": pitch_title,  # Add pitch_title here
            "decision": decision,
            "summary": f"Pitch '{pitch_title}' was marked as 'maybe' for later review. Consider revisiting this opportunity after reviewing more details.",
            "content": f"## Opportunity: {pitch_title}\n\n**Description:** {pitch_description}\n\n**Status:** Marked for later review\n**Decision:** {decision}\n\n**Next Steps:** Review market fit, team background, and traction metrics.",
            "notes": "This pitch requires further consideration. Review market fit, team background, and traction metrics before making final decision.",
            "created_at": datetime.datetime.utcnow(),
            "status": "pending_review"
        }
        
        # Store the summary in summaries collection
        result = summaries.insert_one(summary_data)
        print(f"✅ Summary created with ID: {result.inserted_id}")
        print(f"📋 Summary data: {summary_data}")
        
        return state
        
    except Exception as e:
        print(f"❌ Error providing summary: {e}")
        import traceback
        traceback.print_exc()
        return state

def add_to_investor_feed_blocker(state: AgentState) -> AgentState:
    """Add pitch to blocker list to prevent it from reappearing in feed"""
    try:
        print(f"🚫 Adding pitch {state['pitch_id']} to feed blocker")
        
        investor_id = state["investor_id"]
        entrepreneur_id = state["entrepreneur_id"]
        pitch_id = state["pitch_id"]
        decision = state["decision"]
        
        # Add to feed blocker to prevent this pitch from showing again
        blocker_data = {
            "investor_id": investor_id,
            "entrepreneur_id": entrepreneur_id,
            "pitch_id": pitch_id,
            "decision": decision,
            "blocked_at": datetime.datetime.utcnow(),
            "reason": f"investor_{decision}",
            "status": "blocked"
        }
        
        investor_feed_blocker.update_one(
            {
                "investor_id": investor_id,
                "pitch_id": pitch_id
            },
            {
                "$set": blocker_data
            },
            upsert=True
        )
        
        print(f"✅ Pitch {pitch_id} added to feed blocker")
        
        return state
        
    except Exception as e:
        print(f"❌ Error adding to feed blocker: {e}")
        return state
# ------------------------- LangGraph Workflow -------------------------
# ------------------------- LangGraph Workflow -------------------------
def create_decision_workflow():
    """Create the complete decision workflow"""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("router", router)
    workflow.add_node("matched", handle_matched)
    workflow.add_node("maybe", handle_maybe)
    workflow.add_node("rejected", handle_rejected)
    workflow.add_node("dlt_from_feed", delete_from_feed)
    workflow.add_node("provide_clear_summary", provide_clear_summary)
    workflow.add_node("add_to_investor_feed_blocker", add_to_investor_feed_blocker)

    # Define flow
    workflow.add_edge(START, "router")
    workflow.add_conditional_edges(
        "router",
        lambda state: state["decision"],
        {
            "matched": "matched",
            "maybe": "maybe", 
            "rejected": "rejected"
        }
    )
    workflow.add_edge("matched", "add_to_investor_feed_blocker")
    workflow.add_edge("maybe", "provide_clear_summary")
    workflow.add_edge("rejected", "add_to_investor_feed_blocker")
    workflow.add_edge("add_to_investor_feed_blocker", "dlt_from_feed")
    workflow.add_edge("provide_clear_summary", "dlt_from_feed")
    workflow.add_edge("dlt_from_feed", END)

    return workflow.compile()

#--------------------------
# ------------------------- Main Decision Processor -------------------------
def process_investor_decision(investor_id: str, entrepreneur_id: str, pitch_id: str, decision: str):
    """
    Process investor decision using the LangGraph workflow
    """
    try:
        # Validate decision
        if decision not in ["matched", "maybe", "rejected"]:
            raise ValueError("Decision must be 'matched', 'maybe', or 'rejected'")

        # Create initial state
        initial_state = AgentState(
            investor_id=investor_id,
            entrepreneur_id=entrepreneur_id,
            pitch_id=pitch_id,
            decision=decision,
            timestamp=datetime.datetime.utcnow().isoformat()
        )

        print(f"🎯 Processing investor decision: {decision}")
        print(f"   Investor: {investor_id}")
        print(f"   Entrepreneur: {entrepreneur_id}")
        print(f"   Pitch: {pitch_id}")

        # Execute workflow
        workflow = create_decision_workflow()
        result = workflow.invoke(initial_state)

        print("✅ Decision processing completed successfully")
        return {
            "status": "success",
            "decision": decision,
            "investor_id": investor_id,
            "entrepreneur_id": entrepreneur_id,
            "pitch_id": pitch_id,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }

    except Exception as e:
        print(f"❌ Error processing decision: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }
