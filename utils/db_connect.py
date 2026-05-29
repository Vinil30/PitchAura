from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["SaaS"] 

# Collections
users = db["users"]
pitches = db["pitches"]
investor_feed = db["investor_feed"]
investor_rejections = db["investor_rejections"]
investor_ent_matches = db["investor_ent_macthes"]
investor_maybe = db["investor_maybe"]
preferences = db["preferences"]
investor_feed_blocker = db["investor_feed_blocker"]
summaries = db["summaries"]
pitches = db["pitches"]