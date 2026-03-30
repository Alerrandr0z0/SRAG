from fastapi.testclient import TestClient
from srag.api.main import app
import json

client = TestClient(app)

endpoints = [
    "/summary",
    "/trends?last_n_weeks=26&weeks_to_predict=4&lookback_weeks=8",
    "/virus?detail_level=summary",
    "/territory_bootstrap?min_cases=5&entities_min_cases=3&entities_limit=40",
    "/units?min_cases=3",
    "/clinical_flow",
    "/hospitalization_duration",
    "/citizen_bootstrap",
    "/laboratory_network"
]

print("--- DIAGNÓSTICO DE ENDPOINTS ---")
for ep in endpoints:
    try:
        print(f"Testando {ep}...", end=" ")
        response = client.get(ep)
        if response.status_code == 200:
            print("OK ✅")
        else:
            print(f"ERRO {response.status_code} ❌")
            print(f"Detalhe: {response.text}")
    except Exception as e:
        print(f"FALHA CRÍTICA: {e}")
print("--- FIM DO DIAGNÓSTICO ---")
