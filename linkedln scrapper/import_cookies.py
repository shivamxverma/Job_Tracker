import json
from pathlib import Path

def convert_cookies():
    project_root = Path(__file__).resolve().parent
    raw_cookies_path = project_root / "raw_cookies.json"
    output_path = project_root / "data" / "linkedin_storage_state.json"
    
    if not raw_cookies_path.exists():
        print(f"Error: Could not find raw_cookies.json at {raw_cookies_path}")
        print("Please create this file and paste your exported cookies JSON array inside it.")
        return
        
    try:
        with open(raw_cookies_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON from raw_cookies.json: {e}")
        return
        
    # Handle both wrapped playwright structure and plain cookie list
    if isinstance(raw_data, dict) and "cookies" in raw_data:
        cookies_list = raw_data["cookies"]
    elif isinstance(raw_data, list):
        cookies_list = raw_data
    else:
        print("Error: JSON must be either a list of cookies or a Playwright storage state object.")
        return
        
    converted_cookies = []
    for c in cookies_list:
        # Map Chrome extension keys to Playwright keys
        expires = c.get("expirationDate") or c.get("expires")
        
        # Playwright sameSite options: "Strict", "Lax", "None"
        raw_same_site = c.get("sameSite", "Lax")
        same_site = "Lax"
        if raw_same_site in ["strict", "Strict"]:
            same_site = "Strict"
        elif raw_same_site in ["lax", "Lax"]:
            same_site = "Lax"
        elif raw_same_site in ["no_restriction", "None", "none"]:
            same_site = "None"
            
        converted = {
            "name": c.get("name"),
            "value": c.get("value"),
            "domain": c.get("domain"),
            "path": c.get("path", "/"),
            "expires": int(expires) if expires else -1,
            "httpOnly": c.get("httpOnly", False),
            "secure": c.get("secure", False),
            "sameSite": same_site
        }
        converted_cookies.append(converted)
        
    playwright_state = {
        "cookies": converted_cookies,
        "origins": []
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(playwright_state, f, indent=2)
        
    print(f"\nSuccess! Successfully converted {len(converted_cookies)} cookies.")
    print(f"Saved Playwright storage state to: {output_path}")

if __name__ == "__main__":
    convert_cookies()
