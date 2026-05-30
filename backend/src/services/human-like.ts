import type { Page, Locator } from "playwright";

// ──────────────────────────────────────────────
// Random delay utilities
// ──────────────────────────────────────────────

/**
 * Returns a random integer between min and max (inclusive).
 */
export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Pauses execution for a random human-like duration.
 * Simulates a person reading content on the page.
 */
export async function humanPause(
  page: Page,
  minMs: number = 2000,
  maxMs: number = 5000
): Promise<void> {
  const delay = randomDelay(minMs, maxMs);
  console.log(`[Human] Pausing for ${(delay / 1000).toFixed(1)}s (reading)...`);
  await page.waitForTimeout(delay);
}

/**
 * Short micro-pause to simulate real-time human hesitation.
 */
export async function microPause(page: Page): Promise<void> {
  await page.waitForTimeout(randomDelay(300, 900));
}

// ──────────────────────────────────────────────
// Human-like typing
// ──────────────────────────────────────────────

/**
 * Types text into a field with random per-keystroke delays,
 * mimicking real human typing speed variations.
 * Occasionally introduces brief "thinking" pauses mid-word.
 */
export async function humanType(
  page: Page,
  selector: string | Locator,
  text: string,
  options: { clearFirst?: boolean } = {}
): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;

  // Focus the field first
  await locator.click();
  await microPause(page);

  // Clear existing content if requested
  if (options.clearFirst) {
    await locator.fill("");
    await page.waitForTimeout(randomDelay(200, 500));
  }

  console.log(`[Human] Typing "${text.slice(0, 30)}${text.length > 30 ? "..." : ""}" (${text.length} chars)`);

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Type the character
    await page.keyboard.type(char, { delay: 0 });

    // Per-keystroke delay: 60–220ms (realistic WPM range)
    const keystrokeDelay = randomDelay(60, 220);
    await page.waitForTimeout(keystrokeDelay);

    // Occasionally add a longer "thinking" pause (roughly every 8-15 chars)
    if (i > 0 && i % randomDelay(8, 15) === 0) {
      await page.waitForTimeout(randomDelay(400, 1200));
    }
  }

  // Brief pause after finishing typing (human takes a moment to verify)
  await page.waitForTimeout(randomDelay(300, 800));
}

// ──────────────────────────────────────────────
// Human-like clicking
// ──────────────────────────────────────────────

/**
 * Performs a human-like click on an element:
 * 1. Moves mouse toward the element with natural motion
 * 2. Adds slight random offset from center (humans don't click dead-center)
 * 3. Brief pause before clicking
 */
export async function humanClick(
  page: Page,
  selector: string | Locator
): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;

  // Get element bounding box
  const box = await locator.boundingBox();
  if (!box) {
    // Fallback to standard click if element can't be measured
    console.log("[Human] Element not measurable, using standard click.");
    await locator.click();
    return;
  }

  // Calculate a slightly offset click position (not dead-center)
  const offsetX = randomDelay(-Math.floor(box.width * 0.15), Math.floor(box.width * 0.15));
  const offsetY = randomDelay(-Math.floor(box.height * 0.15), Math.floor(box.height * 0.15));

  const targetX = box.x + box.width / 2 + offsetX;
  const targetY = box.y + box.height / 2 + offsetY;

  // Move mouse towards target with multi-step motion (simulates Bézier-ish curve)
  const currentMouse = { x: randomDelay(100, 500), y: randomDelay(100, 400) };
  const steps = randomDelay(8, 15);

  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    // Ease-in-out interpolation for natural movement
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const x = currentMouse.x + (targetX - currentMouse.x) * eased;
    const y = currentMouse.y + (targetY - currentMouse.y) * eased;

    await page.mouse.move(x, y);
    await page.waitForTimeout(randomDelay(10, 30));
  }

  // Brief hesitation before clicking (like a human aiming)
  await page.waitForTimeout(randomDelay(80, 250));

  // Click at the position
  await page.mouse.click(targetX, targetY);

  // Brief pause after clicking
  await page.waitForTimeout(randomDelay(200, 600));
}

// ──────────────────────────────────────────────
// Human-like scrolling
// ──────────────────────────────────────────────

/**
 * Scrolls the page in small increments with variable speed,
 * simulating natural human scroll behavior.
 */
export async function humanScroll(
  page: Page,
  totalAmount: number,
  options: { containerSelector?: string } = {}
): Promise<void> {
  const { containerSelector } = options;
  const scrollSteps = randomDelay(3, 6);
  const perStep = Math.floor(totalAmount / scrollSteps);

  console.log(`[Human] Scrolling ${totalAmount}px in ${scrollSteps} steps...`);

  for (let i = 0; i < scrollSteps; i++) {
    const amount = perStep + randomDelay(-30, 30); // Slight variation per step

    if (containerSelector) {
      await page.evaluate(
        ({ sel, amt }) => {
          const el = document.querySelector(sel);
          if (el) el.scrollBy({ top: amt, behavior: "smooth" });
        },
        { sel: containerSelector, amt: amount }
      );
    } else {
      await page.evaluate((amt) => {
        window.scrollBy({ top: amt, behavior: "smooth" });
      }, amount);
    }

    // Variable pause between scroll steps
    await page.waitForTimeout(randomDelay(400, 1200));
  }
}

// ──────────────────────────────────────────────
// Human-like select dropdown
// ──────────────────────────────────────────────

/**
 * Selects a dropdown option with human-like interaction:
 * click to open, brief pause, then select.
 */
export async function humanSelect(
  page: Page,
  selector: string | Locator,
  optionValue: { label?: string; value?: string }
): Promise<void> {
  const locator = typeof selector === "string" ? page.locator(selector) : selector;

  // Click the dropdown first to "open" it
  await locator.click();
  await page.waitForTimeout(randomDelay(300, 800));

  // Select the option
  if (optionValue.label) {
    await locator.selectOption({ label: optionValue.label });
  } else if (optionValue.value) {
    await locator.selectOption({ value: optionValue.value });
  }

  // Brief pause after selection
  await page.waitForTimeout(randomDelay(200, 500));
}

// ──────────────────────────────────────────────
// Checkpoint / block detection
// ──────────────────────────────────────────────

/**
 * Checks if the page has been redirected to a challenge/checkpoint.
 * Returns the type of block detected, or null if no block.
 */
export function detectBlock(url: string): string | null {
  const patterns: [string, string][] = [
    ["/checkpoint", "checkpoint"],
    ["/challenge", "challenge"],
    ["/authwall", "auth-wall"],
    ["/uas/login", "login-redirect"],
    ["/login", "login-redirect"],
    ["/security/verify", "security-verification"],
  ];

  for (const [pattern, blockType] of patterns) {
    if (url.includes(pattern)) {
      return blockType;
    }
  }
  return null;
}
