# Add This to Your Global User Rules

Copy the section below and add it to your user rules (MEMORY[user_global]):

---

## 11. Testing Requirements (MANDATORY)

### Test-First Development
- **Every new feature MUST include tests before PR is considered complete**
- **No feature is done until tests are written and passing**
- Tests are not optional; they are part of the feature implementation

### Test Creation Rules
- **New Components:** Write e2e tests for user interactions + unit tests for logic
- **New Features:** Write full e2e test covering the user journey
- **Bug Fixes:** Add regression test to prevent reoccurrence
- **Refactoring:** Ensure existing tests pass; update if behavior changed

### Test Types
- **E2E Tests (Playwright):** User-facing features, workflows, interactions
  - Location: `e2e/*.spec.ts`
  - Test complete user journeys from UI perspective
  
- **Unit Tests (Vitest):** Utilities, stores, hooks, business logic
  - Location: `src/**/__tests__/*.test.ts`
  - Test isolated functions and logic

### Quality Standards
- Tests must be **descriptive** (clear what's being tested)
- Tests must be **independent** (no cross-test dependencies)
- Tests must be **deterministic** (no flaky tests)
- Tests must cover **edge cases** (errors, empty states, boundaries)
- Focus on **behavior**, not implementation details

### Development Workflow
1. Create feature branch
2. Write test descriptions (can use `test.skip()` initially)
3. Implement feature
4. Complete test implementations
5. Verify all tests pass: `npm run test:e2e && npm run test:unit`
6. Submit PR (tests are part of code review)
7. Merge only after ALL tests pass ✅

### Coverage Requirements
- **Critical paths:** 100% coverage (auth, data persistence)
- **Core features:** E2E tests for all user flows
- **Utility functions:** 80%+ unit test coverage

### AI Assistant Behavior
- When implementing a new feature, AI MUST:
  1. Ask what tests are needed
  2. Create test files alongside feature code
  3. Ensure tests pass before considering feature complete
  4. Remind about tests if user tries to skip them

- AI should refuse to mark a feature as "done" without tests
- AI should proactively suggest test cases for new features

### Exceptions
- Prototypes/spikes (not for production) - must be marked as such
- Emergency hotfixes - tests MUST follow within 24 hours
- All exceptions require explicit documentation

### References
- Testing Standards: `.agent/rules/testing-requirements.md`
- Test Examples: `e2e/auth.spec.ts`, `e2e/messaging.spec.ts`

---

**Key Principle:** "Code without tests is broken by design."

