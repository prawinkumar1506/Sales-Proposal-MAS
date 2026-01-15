import random
import time

class MockCRM:
    @staticmethod
    def get_client_data(client_name: str) -> dict:
        """Simulates fetching client data from a CRM."""
        time.sleep(0.5)
        
        industry = "Technology" if len(client_name) % 2 == 0 else "Healthcare"
        return {
            "client_id": f"CL-{random.randint(1000, 9999)}",
            "name": client_name,
            "industry": industry,
            "annual_revenue": random.randint(1, 100) * 1000000,
            "trust_score": random.randint(80, 100),
            "previous_deals": random.randint(0, 5)
        }

class MockPricingEngine:
    @staticmethod
    def calculate_pricing(deal_type: str, budget: float, client_data: dict) -> dict:
        """Simulates a pricing calculation engine."""
        time.sleep(0.5)
        
        base_cost = budget * 0.8  # Assume 20% margin target
        discount_allowed = 0.10
        
        if client_data.get("trust_score", 0) > 90:
            discount_allowed = 0.15
            
        return {
            "base_cost": base_cost,
            "suggested_price": budget,
            "margin": (budget - base_cost) / budget,
            "max_discount": discount_allowed,
            "currency": "USD"
        }

class MockComplianceEngine:
    @staticmethod
    def check_compliance(draft_content: str, deal_type: str) -> dict:
        """Simulates a compliance check on the proposal content."""
        time.sleep(0.5)
        
        issues = []
        if "guarantee" in draft_content.lower():
            issues.append("Avoid using the word 'guarantee' without legal approval.")
        if "unlimited" in draft_content.lower():
            issues.append("Unlimited liability must be capped.")
            
        passed = len(issues) == 0
        return {
            "passed": passed,
            "issues": issues,
            "checked_at": time.time()
        }
