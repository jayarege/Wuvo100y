# CODE_BIBLE.md
type: guide
scope: project-wide
updated: 2025-07-25

---

## 🔧 Design Philosophy
- Prioritize architecture decisions with long-term impact.
- Think before you code: clarity beats cleverness.
- Favor small, composable, well-named components.

---

## 🧠 Trust Hierarchy
1. Codebase
2. Documentation
3. Training data / memory / model assumptions

When in doubt, read the code. If it’s unclear, fix the clarity.

---

## ⚙️ Tool Usage Rules
- Use MCP tools first — always.
- Use `git` to:
  - View file history before edits
  - Investigate test failures
  - Understand features through evolution
  - Search (`git grep`) and trace related code
  - Debug CI/CD failures

---

## 📜 Ten Commandments

1. **Use MCP tools before writing code** – Don't guess. Query the system.
2. **Question everything** – Never assume. Confirm with the code.
3. **Write obvious code** – Make it readable without explanations.
4. **Be brutally honest** – No sugar-coating issues or risks.
5. **Preserve context** – Don’t delete logs, history, or clarity.
6. **Commit atomically** – One change per commit. Describe why.
7. **Document the WHY** – The what is obvious. The why lasts.
8. **Test before you say done** – Always validate.
9. **Handle errors explicitly** – Fail loudly and clearly.
10. **Treat user data as sacred** – No shortcuts. Ever.

---

## 🛠 Development Practices

- Use `/slash` commands for repeatable workflows.
- Run tests locally before pushing.
- Ask questions early and often.
- Request current docs — don’t trust outdated memory.
- Use visual input for UI/UX debugging.
- Refactor aggressively, but not blindly.

---

## 🚨 Core Reminder

> Write code as if the person maintaining it is a violent psychopath who knows where you live.  
> Make it **that** clear.

---

_This file shall be reviewed after **every** update to ensure compliance._
