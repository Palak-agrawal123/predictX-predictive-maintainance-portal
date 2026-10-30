"""
Session and Conversation Memory Manager for PredictX RAG Service.
Provides isolated multi-turn session tracking, context preservation,
follow-up query resolution, and history windows.
"""
import time
from typing import Dict, Any, List, Optional
from collections import OrderedDict

class ConversationTurn:
    def __init__(
        self,
        question: str,
        answer: str,
        intent: str,
        rewritten_query: str = "",
        machine_id: Optional[str] = None,
        retrieved_chunk_ids: List[str] = None,
        timestamp: float = None
    ):
        self.question = question
        self.answer = answer
        self.intent = intent
        self.rewritten_query = rewritten_query or question
        self.machine_id = machine_id
        self.retrieved_chunk_ids = retrieved_chunk_ids or []
        self.timestamp = timestamp or time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "question": self.question,
            "answer": self.answer,
            "intent": self.intent,
            "rewritten_query": self.rewritten_query,
            "machine_id": self.machine_id,
            "retrieved_chunk_ids": self.retrieved_chunk_ids,
            "timestamp": self.timestamp
        }

class ConversationSession:
    def __init__(self, session_id: str, max_turns: int = 10):
        self.session_id = session_id
        self.max_turns = max_turns
        self.turns: List[ConversationTurn] = []
        self.active_machine_id: Optional[str] = None
        self.active_component: Optional[str] = None
        self.created_at = time.time()
        self.last_active = time.time()

    def add_turn(
        self,
        question: str,
        answer: str,
        intent: str,
        rewritten_query: str = "",
        machine_id: Optional[str] = None,
        retrieved_chunk_ids: List[str] = None
    ):
        self.last_active = time.time()
        if machine_id:
            self.active_machine_id = machine_id
        
        turn = ConversationTurn(
            question=question,
            answer=answer,
            intent=intent,
            rewritten_query=rewritten_query,
            machine_id=self.active_machine_id,
            retrieved_chunk_ids=retrieved_chunk_ids
        )
        self.turns.append(turn)
        if len(self.turns) > self.max_turns:
            self.turns.pop(0)

    def get_recent_turns(self, n: int = 3) -> List[ConversationTurn]:
        return self.turns[-n:]

    def get_recent_answers(self, n: int = 3) -> List[str]:
        return [t.answer for t in self.turns[-n:]]

class SessionManager:
    """
    Thread-safe in-memory session manager with LRU eviction.
    """
    def __init__(self, max_sessions: int = 500, session_ttl_sec: int = 86400):
        self.max_sessions = max_sessions
        self.session_ttl_sec = session_ttl_sec
        self._sessions: OrderedDict[str, ConversationSession] = OrderedDict()

    def get_or_create_session(self, session_id: Optional[str]) -> ConversationSession:
        if not session_id or not str(session_id).strip():
            session_id = "default-anonymous-session"

        clean_id = str(session_id).strip()
        now = time.time()

        if clean_id in self._sessions:
            session = self._sessions[clean_id]
            # Check TTL
            if now - session.last_active > self.session_ttl_sec:
                session = ConversationSession(clean_id)
                self._sessions[clean_id] = session
            self._sessions.move_to_end(clean_id)
            return session

        # Evict oldest if full
        if len(self._sessions) >= self.max_sessions:
            self._sessions.popitem(last=False)

        session = ConversationSession(clean_id)
        self._sessions[clean_id] = session
        return session

    def resolve_followup(
        self,
        session_id: Optional[str],
        current_query: str,
        explicit_machine_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Detects follow-up intent and resolves antecedents using session memory.
        Returns resolved query, effective machine_id, and is_followup flag.
        """
        session = self.get_or_create_session(session_id)
        q_lower = current_query.strip().lower()
        
        # Determine effective machine_id
        effective_machine_id = explicit_machine_id or session.active_machine_id

        # Follow-up indicators
        followup_phrases = [
            "what about", "how about", "why is that", "explain that", "what does that mean",
            "can you elaborate", "tell me more", "how to fix it", "how do i fix", "what should i do",
            "is it critical", "what about its", "and its", "how does this affect", "what about the"
        ]
        pronouns = [" it", " this", " that", " its", " these"]
        
        has_followup_phrase = any(phrase in q_lower for phrase in followup_phrases)
        has_pronoun = any(p in q_lower for p in pronouns)
        is_short_fragment = len(q_lower.split()) <= 4 and ("why" in q_lower or "how" in q_lower or "what" in q_lower)
        
        is_followup = bool(session.turns) and (has_followup_phrase or has_pronoun or is_short_fragment)

        rewritten = current_query
        if is_followup and session.turns:
            last_turn = session.turns[-1]
            last_topic = last_turn.question

            if effective_machine_id and effective_machine_id.lower() not in q_lower:
                rewritten = f"{current_query} (Referring to asset {effective_machine_id})"
            elif last_topic and not any(k in q_lower for k in ["predictive", "maintenance", "c-mapss"]):
                rewritten = f"{current_query} (In context of previous topic: '{last_topic}')"

        return {
            "rewritten_query": rewritten,
            "effective_machine_id": effective_machine_id,
            "is_followup": is_followup,
            "session": session
        }

# Global singleton
session_manager = SessionManager()
