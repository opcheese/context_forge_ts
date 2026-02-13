# EARS Reference Card

EARS (Easy Approach to Requirements Syntax) provides 5 sentence templates that eliminate ambiguity in requirements.
Each pattern forces you to specify the actor, the trigger, and the expected behavior.

## The 5 EARS Patterns

| Pattern | Template | Example | Common Mistake |
|---------|----------|---------|---------------|
| **Ubiquitous** | The [system] shall [action]. | The system shall display prices in the user's local currency. | Missing the actor -- "It should work offline" (who/what?) |
| **Event-driven** | WHEN [event], the [system] shall [action]. | WHEN a payment fails, the system shall notify the user within 30 seconds. | Vague triggers -- "When needed" instead of a specific, observable event |
| **State-driven** | WHILE [state], the [system] shall [action]. | WHILE the user is on a metered connection, the app shall compress images before download. | Confusing state with event -- states persist over time, events happen once |
| **Conditional** | IF [condition], THEN the [system] shall [action]. | IF the cart total exceeds $100, THEN the system shall apply free shipping. | Missing the ELSE -- what happens when the condition is false? |
| **Unwanted behavior** | IF [unwanted condition], THEN the [system] shall [action]. | IF the session has been idle for 30 minutes, THEN the system shall prompt re-authentication. | Writing what the system "should not" do instead of what it SHALL do in response |

## When to Use Which

- **Ubiquitous** -- always-true rules. No trigger, no condition. The system just does this, all the time.
- **Event-driven** -- reactions to discrete occurrences. Something happens, then the system responds.
- **State-driven** -- ongoing conditions. The system behaves differently as long as a state holds.
- **Conditional** -- branching logic. One path when true, another when false (write both).
- **Unwanted behavior** -- error cases, edge cases, abuse scenarios. What the system does when things go wrong.

## Quality Test

Every EARS requirement should be **testable** -- you should be able to write a pass/fail test case from the requirement sentence alone. If you cannot, the requirement is too vague.

Checklist for each requirement:

- Has an explicit **actor** (the system, the API, the notification service -- not "it").
- Has a **measurable action** (display, send, reject -- not "handle" or "process").
- Has a **trigger or scope** (WHEN/WHILE/IF for non-ubiquitous patterns).
- Can be verified as **done or not done** without subjective judgment.

## Usage at L1 (IRD)

- Group requirements by **user goal**, not by system component. A user does not care which microservice fulfills the requirement.
- Use **persona names** from L2 when available (e.g., "WHEN Operator submits a batch..." instead of "WHEN the user...").
- Start with Ubiquitous requirements (the baseline), then layer Event-driven and Conditional on top. Unwanted-behavior requirements come last -- they are the edge cases you discover during review.
- Aim for **one requirement per sentence**. Compound requirements ("shall X and Y") hide scope and make testing harder.
