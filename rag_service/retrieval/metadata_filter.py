"""
Metadata Filtering Engine for PredictX Retrieval Pipeline.
Builds and validates metadata filters for targeted semantic retrieval.
"""
from typing import Dict, Any, Optional

VALID_FILTER_FIELDS = {
    "machine_type",
    "component",
    "category",
    "document_id",
    "document_name"
}

class MetadataFilterBuilder:
    @staticmethod
    def build_filter(
        machine_type: Optional[str] = None,
        component: Optional[str] = None,
        category: Optional[str] = None,
        document_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Builds a validated filter dictionary compatible with ChromaDB.
        """
        filters = {}
        if machine_type and machine_type != "ALL":
            filters["machine_type"] = machine_type.upper()
        if component and component != "ALL":
            filters["component"] = component.upper()
        if category and category != "ALL":
            filters["category"] = category.lower()
        if document_id:
            filters["document_id"] = document_id

        return filters if filters else None

metadata_filter_builder = MetadataFilterBuilder()
