# CODE_BIBLE.md
type: guide
scope: project-wide

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
- Request current docs — don't trust outdated memory.
- Use visual input for UI/UX debugging.
- Refactor aggressively, but not blindly.
- After completing changes, respond with ONLY the list of modified files.

---

## 📋 Mandatory Requirement Articulation Process

**BEFORE ANY IMPLEMENTATION**, you MUST follow this process:

1. **Re-articulate requirements** in your own words
2. **Identify specific actions** needed for each requirement  
3. **Define implementation steps** with clear dependencies
4. **Plan Sub-Agent usage** and parallel/series execution
5. **Create complete TODO list** and wait for confirmation

**Template to follow:**
```
```
Can you please re-articulate to me the concrete and specific 
  requirements I have given you using your own words, include what those specific requirements are and for each requirement what actions you need to 
  take, what steps you need to take to implement my requirements, and a short plain text description of how you are going to complete the task, include
   how you will use of Sub-Agents and what will be done in series and what can be done in parallel. Also, re-organise the requirements into their 
  logical & sequential order of implementation including any dependancies, and finally finish with a complete TODO list, then wait for my confirmation
---

## 🚨 Core Reminder

> Write code as if the person maintaining it is a violent psychopath who knows where you live.  
> Make it **that** clear.

---

_This file shall be reviewed after **every** update to ensure compliance.
After completing changes, list **every** file name that were modified, added or deleted. Just the file name, nothing more
