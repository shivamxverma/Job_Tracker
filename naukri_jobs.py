import argparse
import csv
import logging
import random
import re
import time
from pathlib import Path
from urllib.parse import urljoin

from selenium import webdriver
from selenium.common.exceptions import (
    NoSuchWindowException,
    SessionNotCreatedException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

DEFAULT_SEARCH_URLS = [
    "https://www.naukri.com/backend-jobs?experience=0",
    "https://www.naukri.com/fullstack-jobs?experience=0",
    "https://www.naukri.com/sde-jobs?experience=0",
]

TITLE_INCLUDE_TERMS = {
    "backend",
    "back-end",
    "full stack",
    "fullstack",
    "software engineer",
    "software developer",
    "sde",
    "developer",
}

TITLE_EXCLUDE_TERMS = {
    "senior",
    "staff",
    "principal",
    "lead",
    "manager",
    "architect",
    "director",
    "vp",
    "head",
}

ENTRY_LEVEL_INCLUDE_TERMS = {
    "0-1",
    "0 to 1",
    "0–1",
    "0-2",
    "0 to 2",
    "0–2",
    "0-0",
    "0 year",
    "1 year",
    "0-3",
    "new grad",
    "entry level",
    "entry-level",
    "fresher",
    "graduate",
    "intern",
    "internship",
    "junior",
}

OUTPUT_FIELDS = [
    "title",
    "company",
    "location",
    "experience_text",
    "salary_text",
    "entry_level_match_reason",
    "source_page",
    "job_link",
    "card_text",
]


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def normalize_space(value: str) -> str:
    return " ".join((value or "").split())


def matches_any(text: str, terms: set[str]) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in terms)


def is_relevant_title(title: str) -> bool:
    lowered = title.lower()
    return matches_any(lowered, TITLE_INCLUDE_TERMS) and not matches_any(
        lowered, TITLE_EXCLUDE_TERMS
    )


def is_entry_level_naukri(experience_text: str, card_text: str) -> tuple[bool, str]:
    # Try to parse the experience years directly from experience_text
    # E.g. "0-2 Yrs", "1-3 Yrs", "2-5 Yrs"
    match = re.search(r"(\d+)\s*-\s*(\d+)\s*Yrs", experience_text, re.IGNORECASE)
    if match:
        min_exp = int(match.group(1))
        if min_exp >= 2:
            return False, ""
        return True, f"min exp is {min_exp}"
    
    # Or just "0 Yrs", "1 Yr", etc.
    match_single = re.search(r"(\d+)\s*Yrs?", experience_text, re.IGNORECASE)
    if match_single:
        exp = int(match_single.group(1))
        if exp >= 2:
            return False, ""
        return True, f"exp is {exp}"
        
    # Check general keywords if not parsed
    lowered = (experience_text + " " + card_text).lower()
    for term in sorted(ENTRY_LEVEL_INCLUDE_TERMS):
        if term in lowered:
            return True, term
            
    return False, ""


def resolve_chrome_binary() -> str | None:
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return None


def resolve_profile_options(profile_dir: str | None) -> tuple[str | None, str | None]:
    if not profile_dir:
        return None, None

    profile_path = Path(profile_dir).expanduser().resolve()
    if (
        profile_path.name in {"Default", "Guest Profile"}
        or profile_path.name.startswith("Profile ")
    ) and profile_path.parent.exists():
        return str(profile_path.parent), profile_path.name

    return str(profile_path), None


def build_driver(headless: bool = False, profile_dir: str | None = None) -> webdriver.Chrome:
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--start-maximized")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--remote-allow-origins=*")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    chrome_binary = resolve_chrome_binary()
    if chrome_binary:
        options.binary_location = chrome_binary

    user_data_dir, profile_name = resolve_profile_options(profile_dir)
    if user_data_dir:
        options.add_argument(f"--user-data-dir={user_data_dir}")
    if profile_name:
        options.add_argument(f"--profile-directory={profile_name}")

    try:
        return webdriver.Chrome(service=Service(), options=options)
    except SessionNotCreatedException as exc:
        raise RuntimeError(
            "Chrome could not be started by Selenium. Close all Chrome windows or use a"
            " dedicated folder like /Users/shivamverma/Desktop/Job-Scraper/naukri-chrome-data."
            f" Original error: {exc.msg}"
        ) from exc


def wait_for_page(driver: webdriver.Chrome) -> None:
    WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    time.sleep(random.uniform(4.0, 6.0))  # Naukri benefits from a bit longer load wait


def scroll_page(driver: webdriver.Chrome, scrolls: int) -> None:
    last_height = driver.execute_script("return document.body.scrollHeight")
    for i in range(scrolls):
        logging.info("Scroll %d/%d", i + 1, scrolls)
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(random.uniform(2.5, 4.0))
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height


def collect_raw_cards(driver: webdriver.Chrome) -> list[dict]:
    script = """
    const items = [];
    const seen = new Set();
    const wrappers = document.querySelectorAll('.srp-jobtuple-wrapper');
    for (const wrapper of wrappers) {
      const anchor = wrapper.querySelector('a.title');
      if (!anchor) continue;
      const title = (anchor.innerText || "").trim();
      const href = anchor.href || "";
      if (!title || !href || seen.has(href)) continue;
      
      const compAnchor = wrapper.querySelector('a.comp-name') || wrapper.querySelector('.comp-name');
      const company = compAnchor ? (compAnchor.innerText || "").trim() : "";
      
      const locSpan = wrapper.querySelector('.locWdth') || wrapper.querySelector('.loc-wrap') || wrapper.querySelector('[class*="loc"]');
      const location = locSpan ? (locSpan.innerText || "").trim() : "";
      
      const expSpan = wrapper.querySelector('.expwdth') || wrapper.querySelector('.exp-wrap') || wrapper.querySelector('[class*="exp"]');
      const experience = expSpan ? (expSpan.innerText || "").trim() : "";
      
      const salSpan = wrapper.querySelector('.salWdth') || wrapper.querySelector('.sal-wrap') || wrapper.querySelector('[class*="sal"]');
      const salary = salSpan ? (salSpan.innerText || "").trim() : "";
      
      const cardText = (wrapper.innerText || "").trim();
      items.push({title, href, company, location, experience, salary, cardText});
      seen.add(href);
    }
    return items;
    """
    return driver.execute_script(script)


def extract_job_from_card(raw_card: dict, source_page: str) -> dict | None:
    title = normalize_space(raw_card.get("title", ""))
    job_link = raw_card.get("href", "")
    company = normalize_space(raw_card.get("company", ""))
    location = normalize_space(raw_card.get("location", ""))
    experience_text = normalize_space(raw_card.get("experience", ""))
    salary_text = normalize_space(raw_card.get("salary", ""))
    card_text = normalize_space(raw_card.get("cardText", ""))

    if not title or not job_link:
        return None

    if not is_relevant_title(title):
        return None

    entry_level_ok, reason = is_entry_level_naukri(experience_text, card_text)
    if not entry_level_ok:
        return None

    return {
        "title": title,
        "company": company,
        "location": location,
        "experience_text": experience_text,
        "salary_text": salary_text,
        "entry_level_match_reason": reason,
        "job_link": urljoin("https://www.naukri.com", job_link),
        "source_page": source_page,
        "card_text": card_text,
    }


def dedupe_jobs(jobs: list[dict]) -> list[dict]:
    seen = set()
    unique_jobs = []
    for job in jobs:
        key = job.get("job_link")
        if not key or key in seen:
            continue
        seen.add(key)
        unique_jobs.append(job)
    return unique_jobs


def save_csv(rows: list[dict], output_path: str) -> None:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    logging.info("Saved %s Naukri jobs to %s", len(rows), path)


def load_search_urls(args: argparse.Namespace) -> list[str]:
    urls = list(args.search_url or [])
    if args.search_urls_file:
        urls.extend(
            [
                line.strip()
                for line in Path(args.search_urls_file).read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
        )
    if not urls:
        urls = DEFAULT_SEARCH_URLS
    return list(dict.fromkeys(urls))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape entry-level backend/full-stack/SDE jobs from Naukri.com."
    )
    parser.add_argument(
        "--search-url",
        action="append",
        help="Naukri search page URL to scrape. Repeat this flag for multiple pages.",
    )
    parser.add_argument(
        "--search-urls-file",
        help="Optional text file with one Naukri search URL per line.",
    )
    parser.add_argument(
        "--profile-dir",
        default="naukri-chrome-data",
        help="Chrome user data dir for the browser session.",
    )
    parser.add_argument(
        "--scrolls",
        type=int,
        default=5,
        help="How many times to scroll each Naukri search page.",
    )
    parser.add_argument(
        "--output",
        default="naukri_entry_level_jobs.csv",
        help="Output CSV file.",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run Chrome headless.",
    )
    return parser.parse_args()


def main() -> None:
    configure_logging()
    args = parse_args()
    search_urls = load_search_urls(args)
    driver = build_driver(headless=args.headless, profile_dir=args.profile_dir)
    jobs = []
    try:
        for url in search_urls:
            logging.info("Opening %s", url)
            driver.get(url)
            wait_for_page(driver)
            scroll_page(driver, args.scrolls)
            raw_cards = collect_raw_cards(driver)
            logging.info("Collected %s raw cards from Naukri", len(raw_cards))
            for raw_card in raw_cards:
                job = extract_job_from_card(raw_card, url)
                if job:
                    jobs.append(job)
    except (TimeoutException, NoSuchWindowException, WebDriverException) as exc:
        raise RuntimeError(f"Naukri scraping failed: {exc}") from exc
    finally:
        driver.quit()

    save_csv(dedupe_jobs(jobs), args.output)


if __name__ == "__main__":
    main()
