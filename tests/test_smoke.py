"""Boot smoke test: the app starts and every nav tab renders on an empty DB.

This is the CI analog of the manual verification baseline in spec.md ("all nav
tabs load HTTP 200"). It runs against a fresh, empty temp database (see
conftest.py), so it also proves the app handles the no-data state.
"""

NAV_ROUTES = [
    "/",
    "/transactions",
    "/monthly",
    "/budget",
    "/settings",
    "/rules",
    "/upload",
]


def test_nav_routes_return_200(client):
    for route in NAV_ROUTES:
        resp = client.get(route)
        assert resp.status_code == 200, f"{route} returned {resp.status_code}"


def test_insights_api_returns_json(client):
    resp = client.get("/api/insights")
    assert resp.status_code == 200
    data = resp.get_json()
    # Empty DB → zeroed KPIs, but the shape must be there.
    assert data["total_spent"] == 0
    assert data["tx_count"] == 0
    assert "by_category" in data


def test_sunburst_api_ok_on_empty_db(client):
    resp = client.get("/api/sunburst")
    assert resp.status_code == 200
    assert "children" in resp.get_json()
