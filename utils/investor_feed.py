from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from utils.vectorstore_utils import get_retriever
from utils.feed_summarizer import FeedSummarizer
from utils.db_connect import investor_feed, pitches, preferences
from bson import ObjectId
import datetime
import json

def _pitch_exists(pitch_id):
    if not pitch_id or pitch_id == "unknown":
        return False
    try:
        if pitches.find_one({"_id": ObjectId(pitch_id)}):
            return True
    except Exception:
        pass
    return pitches.find_one({"_id": pitch_id}) is not None

class AgentState(TypedDict):
    feed: dict
    retrieved_info: dict
    investor_needs: dict
    final_inv_feed: dict

def get_investor_preferences(state: AgentState) -> AgentState:
    """Get investor preferences from database"""
    investor_id = state["feed"]["investor_id"]
    prefs = preferences.find_one({"user_id": ObjectId(investor_id)}) or {}
    state["investor_needs"] = prefs
    return state

def feed_collection(state: AgentState) -> AgentState:
    """Retrieve relevant pitches based on investor preferences"""
    try:
        retriever = get_retriever()
        print(f"🔍 Retrieving pitches for investor: {state['feed']['investor_id']}")
        
        # Build query from investor preferences
        query_parts = []
        if state["investor_needs"].get("focus_areas"):
            query_parts.append(f"Industries: {', '.join(state['investor_needs']['focus_areas'])}")
        if state["investor_needs"].get("team_criteria"):
            query_parts.append(f"Team: {state['investor_needs']['team_criteria']}")
        
        query = " ".join(query_parts) if query_parts else "startup investment opportunities"
        print(f"🔍 Search query: {query}")
        
        docs = retriever.get_relevant_documents(query)
        print(f"🔍 Found {len(docs)} relevant documents")
        
        state["retrieved_info"] = "\n".join([d.page_content for d in docs[:15]])
        return state
        
    except Exception as e:
        print(f"❌ Error in feed_collection: {e}")
        state["retrieved_info"] = ""
        return state

def feed_summaries(state: AgentState) -> AgentState:
    """Generate personalized feed summaries using the actual pitch data"""
    summarizer = FeedSummarizer()
    
    # Build investor query from preferences
    investor_query_parts = []
    if state["investor_needs"].get("focus_areas"):
        investor_query_parts.append(f"Interested in: {', '.join(state['investor_needs']['focus_areas'])}")
    if state["investor_needs"].get("team_criteria"):
        investor_query_parts.append(f"Team preferences: {state['investor_needs']['team_criteria']}")
    
    investor_query = " ".join(investor_query_parts) if investor_query_parts else "startup investment opportunities"
    
    # Get the actual documents with metadata to preserve IDs
    retriever = get_retriever()
    query_parts = []
    if state["investor_needs"].get("focus_areas"):
        query_parts.append(f"Industries: {', '.join(state['investor_needs']['focus_areas'])}")
    query = " ".join(query_parts) if query_parts else "startup investment opportunities"
    
    docs = retriever.get_relevant_documents(query)
    unique_docs = []
    seen_pitch_ids = set()
    for doc in docs:
        pitch_id = str(doc.metadata.get("pitch_id", ""))
        if pitch_id in seen_pitch_ids or not _pitch_exists(pitch_id):
            continue
        seen_pitch_ids.add(pitch_id)
        unique_docs.append(doc)
    
    # Use the FeedSummarizer to generate summaries but with actual pitch data
    feed_data = summarizer.generate_feed_summary(
        investor_id=state["feed"]["investor_id"],
        investor_query=investor_query,
        retrieved_info=state["retrieved_info"],
        documents=unique_docs[:10]  # Pass actual, current, deduped documents with metadata
    )
    
    # Add match scores to each item
    deduped_matches = []
    seen_match_ids = set()
    for match in feed_data.get("matches", []):
        pitch_id = str(match.get("pitch_id", ""))
        if pitch_id in seen_match_ids or not _pitch_exists(pitch_id):
            continue
        seen_match_ids.add(pitch_id)
        match["match_score"] = calculate_match_score(state["investor_needs"], match.get("summary", ""))
        deduped_matches.append(match)
    feed_data["matches"] = deduped_matches
    
    state["final_inv_feed"] = feed_data
    return state

def save_feed_in_investordb(state: AgentState) -> AgentState:
    """Save AI-generated feed to database"""
    feed_data = state.get("final_inv_feed", {})
    if not feed_data or "investor_id" not in feed_data:
        print("No valid feed data found.")
        return state

    # Ensure investor_id is string (not ObjectId)
    feed_data["investor_id"] = str(feed_data["investor_id"])
    
    investor_feed.update_one(
        {"investor_id": feed_data["investor_id"]},
        {"$set": feed_data},
        upsert=True
    )
    print(f"Feed saved for investor {feed_data['investor_id']} with {len(feed_data.get('matches', []))} matches")
    return state

def calculate_match_score(investor_needs, pitch_content):
    """Calculate match score between investor preferences and pitch content"""
    score = 50  
    
    focus_areas = investor_needs.get("focus_areas", [])
    for area in focus_areas:
        if area.lower() in pitch_content.lower():
            score += 10
    
    return min(score, 100)


def create_feed_generation_workflow():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("get_preferences", get_investor_preferences)
    workflow.add_node("collect_feed", feed_collection)
    workflow.add_node("summarize_feed", feed_summaries)
    workflow.add_node("save_feed", save_feed_in_investordb)
    
    workflow.add_edge(START, "get_preferences")
    workflow.add_edge("get_preferences", "collect_feed")
    workflow.add_edge("collect_feed", "summarize_feed")
    workflow.add_edge("summarize_feed", "save_feed")
    workflow.add_edge("save_feed", END)
     
    return workflow.compile()
