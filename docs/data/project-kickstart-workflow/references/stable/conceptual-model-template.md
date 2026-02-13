# Conceptual Model

Entities and relationships from the user's perspective. This is NOT a database schema — no IDs, no foreign keys, no data types. Plain language only.

---

## Glossary

| Term | Definition | First Appeared In | Used By |
|------|-----------|-------------------|---------|
| [Entity name] | [What it is in plain language] | [Which scenario/persona introduced it] | [Which personas interact with it] |
| | | | |

**Rules:**
- Every term should trace back to a scenario or persona
- If a term doesn't appear in any scenario, question whether it belongs
- Use the user's language, not technical jargon
- Resolve synonyms: if two personas call the same thing different names, pick one and note the alias

## Entity Relationships

Describe in plain English. Format: "[Entity A] has/contains/belongs to [Entity B]"

- [e.g., "A Customer has many Orders"]
- [e.g., "An Order contains one or more Items"]
- [e.g., "An Item belongs to exactly one Category"]

**Ask:** Can you trace each relationship to a specific scenario step? If not, it may be premature.

## State Transitions

For entities that change state during scenarios:

### [Entity Name]

| State | Meaning | Triggered By | Next States |
|-------|---------|-------------|-------------|
| [e.g., Draft] | [What this means for the user] | [What action/event] | [Where it can go] |
| | | | |

## Invariants

Rules that must always be true:
- [e.g., "An Order must belong to exactly one Customer"]
- [e.g., "A published Article cannot be deleted, only archived"]
- [e.g., "A User's balance cannot go below zero"]

## Boundary Decisions

| Concept | In System | External | Rationale |
|---------|-----------|----------|-----------|
| [e.g., Payment processing] | [ ] | [x] | [e.g., "Use Stripe — not our core competency"] |
| [e.g., Email notifications] | [x] | [ ] | [e.g., "Core to user scenarios 2 and 4"] |
