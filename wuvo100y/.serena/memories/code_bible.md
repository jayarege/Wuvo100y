# CODE_BIBLE Principles

Based on the codebase analysis, the CODE_BIBLE commandments include:

## Core Commandments:
1. **Never assume** - validate inputs and data
2. **Write code that's clear and obvious** - prioritize readability
3. **Handle errors explicitly** - no silent failures
4. **Test before declaring done** - verify functionality
5. **Treat user data as sacred** - give full control
6. **Document WHY each decision matters** - context is crucial
7. **Clear visual separation** - obvious UI hierarchy
8. **Use refs to prevent cascade re-fetches** - performance optimization
9. **Unified removal utilities** - ensure ALL sections are cleaned
10. **Update both ref and state** - maintain consistency

## Investigation Steps:
1. **Trace data flow** - follow props from source to destination
2. **Validate assumptions** - never assume data exists
3. **Check all connected components** - ensure consistent prop passing
4. **Verify state management** - refs vs state usage
5. **Test edge cases** - empty states, missing data
6. **Document findings** - explain WHY issues occur