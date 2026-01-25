# Testing Requirements Rule

## Mandatory Test Creation for New Features

**This rule must be followed for ALL new features, components, and significant changes.**

---

## Rule Statement

**BEFORE implementing any new feature, component, or significant functionality:**

1. **Define test cases** - Write test descriptions for the feature
2. **Implement the feature** - Build the functionality
3. **Write the tests** - Create corresponding e2e/unit tests
4. **Verify coverage** - Ensure tests pass and cover edge cases

**The feature is NOT complete until tests are written and passing.**

---

## What Requires Tests

### ✅ Always Test:
- **New components** (React components, UI elements)
- **New features** (messaging, notifications, etc.)
- **New API routes** (if applicable)
- **New user interactions** (clicks, forms, navigation)
- **State management changes** (store updates, hooks)
- **Real-time functionality** (WebSocket, subscriptions)
- **Authentication/Authorization** (login flows, permissions)
- **Data transformations** (formatters, validators)

### 🔍 Consider Testing:
- **Bug fixes** - Regression tests to prevent reoccurrence
- **Refactoring** - Ensure behavior unchanged
- **Performance optimizations** - Benchmarks when relevant

---

## Test Types Required

### E2E Tests (Playwright)
**When to use:** User-facing features, full workflows

**Required for:**
- Complete user journeys (login → action → logout)
- Multi-step processes (create conversation → send message)
- Cross-browser behavior
- Real-time interactions
- Visual elements and layouts

**Location:** `e2e/*.spec.ts`

### Unit Tests (Vitest)
**When to use:** Logic, utilities, isolated functions

**Required for:**
- Utility functions (formatters, validators)
- Store actions and state updates
- Hooks with complex logic
- Data transformations
- Business logic

**Location:** `src/**/__tests__/*.test.ts`

### Integration Tests
**When to use:** Component + store interactions

**Required for:**
- Component behavior with real store
- API integration (mocked)
- Multi-component workflows

---

## Test Quality Standards

### ✅ All Tests Must:
1. **Be descriptive** - Clear test names explaining what's tested
2. **Be independent** - No dependencies between tests
3. **Be deterministic** - Same result every run (no flakiness)
4. **Test behavior** - Not implementation details
5. **Cover edge cases** - Error states, empty states, boundaries
6. **Be maintainable** - Follow project patterns

### ❌ Avoid:
- Testing third-party libraries
- Over-mocking (defeats the purpose)
- Snapshot tests without clear purpose
- Flaky tests (timing issues)
- Tests that test nothing

---

## Development Workflow

### For New Features:

```
1. Create Feature Branch
   git checkout -b feature/new-messaging-feature

2. Write Test Descriptions (TDD approach)
   // e2e/new-feature.spec.ts
   test.describe('New Feature', () => {
     test('should do X when Y happens', async ({ page }) => {
       test.skip(true, 'Not implemented yet');
     });
   });

3. Implement Feature
   // src/features/...

4. Write/Update Tests
   // Complete the test implementations

5. Verify All Tests Pass
   npm run test:e2e
   npm run test:unit (if applicable)

6. Code Review - Tests are part of review
   - Are tests comprehensive?
   - Do they cover edge cases?
   - Are they maintainable?

7. Merge Only After Tests Pass ✅
```

---

## Coverage Targets

### Minimum Coverage Requirements:
- **E2E Coverage:** Core user flows must be tested
- **Unit Coverage:** 80%+ for utility functions
- **Critical Paths:** 100% (auth, payments, data loss scenarios)

### What "Coverage" Means:
Not just lines of code, but:
- ✅ Happy path tested
- ✅ Error states tested
- ✅ Edge cases tested
- ✅ User experience validated

---

## Examples

### ✅ Good Test Creation

**Feature PR:**
```
feat: Add message editing functionality

- Added edit button to messages
- Created edit modal with validation
- Updated message store with edit action
- Added e2e tests for edit flow
- Added unit tests for edit validation

Tests:
- e2e/message-editing.spec.ts (new)
  ✓ Should show edit button on own messages
  ✓ Should open edit modal on click
  ✓ Should validate edited message
  ✓ Should update message in UI
  ✓ Should show error on failure
  
- src/stores/__tests__/messageStore.test.ts
  ✓ Should update message content
  ✓ Should preserve message ID
  ✓ Should handle edit errors
```

### ❌ Incomplete Feature (Missing Tests)

**Feature PR:**
```
feat: Add message editing functionality

- Added edit button to messages
- Created edit modal
- Updated message store

⚠️ NO TESTS - This PR should NOT be merged
```

---

## Test Maintenance

### When to Update Tests:
- Feature changes behavior
- Bug is discovered (add regression test)
- Refactoring changes component structure
- Deprecated features are removed

### Reviewing Test Changes:
- Why was the test changed?
- Does it still test the same behavior?
- Are new edge cases covered?

---

## Enforcement

### Pre-commit Checks:
```bash
# Add to .husky/pre-commit
npm run test:unit
npm run lint
```

### CI/CD Pipeline:
```yaml
# All tests must pass before merge
- run: npm run test:e2e
- run: npm run test:unit
- run: npm run test:integration
```

### Code Review Checklist:
- [ ] Tests included for new features?
- [ ] Tests pass locally?
- [ ] Edge cases covered?
- [ ] Error states tested?
- [ ] Tests are maintainable?

---

## Exceptions

**Rare cases where tests might be deferred:**

1. **Prototype/Spike** - Exploration only, not for production
2. **Emergency Hotfix** - Critical bug, add tests in follow-up PR (within 24h)
3. **External Dependency** - Waiting on third-party API (mock instead)

**All exceptions require:**
- Explicit documentation in PR
- Follow-up task created
- Approval from tech lead

---

## Resources

- E2E Test Examples: `e2e/auth.spec.ts`, `e2e/messaging.spec.ts`
- Unit Test Examples: `src/**/__tests__/*.test.ts`
- Testing Guide: See project README.md
- Playwright Docs: https://playwright.dev
- Vitest Docs: https://vitest.dev

---

## Summary

**Remember:**
> "Code without tests is broken by design." - Jacob Kaplan-Moss

**Every feature is only complete when:**
1. ✅ Feature implemented
2. ✅ Tests written and passing
3. ✅ Code reviewed
4. ✅ Documentation updated

**No exceptions without explicit approval.**
