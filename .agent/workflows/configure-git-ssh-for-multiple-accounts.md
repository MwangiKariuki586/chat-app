---
description: How to configure Git SSH keys for multiple GitHub accounts (personal/company)
---

# Configuring Git SSH Keys for Multiple GitHub Accounts

This guide walks you through setting up multiple SSH keys for different GitHub accounts (e.g., personal and company) and configuring a specific project to use one of them.

---

## Prerequisites

- Git installed on your system
- Two SSH key pairs generated (one for each account)

---

## Step 1: Generate SSH Keys (If Not Already Done)

If you haven't already created SSH keys for each account, generate them:

```powershell
# Generate personal SSH key
ssh-keygen -t ed25519 -C "your-personal-email@gmail.com" -f ~/.ssh/id_ed25519_personal

# Generate company SSH key
ssh-keygen -t ed25519 -C "your-work-email@company.com" -f ~/.ssh/id_ed25519_company
```

> **Tip:** Use descriptive file names to distinguish between keys (e.g., `id_ed25519_personal`, `id_ed25519_company`).

---

## Step 2: Add SSH Keys to GitHub

1. Copy the public key to your clipboard:
   ```powershell
   # For personal key
   Get-Content ~/.ssh/id_ed25519_personal.pub | Set-Clipboard
   ```

2. Go to **GitHub → Settings → SSH and GPG keys → New SSH key**

3. Paste the key and give it a recognizable title (e.g., "Personal Laptop")

4. Repeat for your company account with the company key

---

## Step 3: Configure SSH Config File

Create or edit the SSH config file at `~/.ssh/config`:

```powershell
notepad $env:USERPROFILE\.ssh\config
```

Add host aliases for each account:

```
# Personal GitHub account
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
  IdentitiesOnly yes

# Company GitHub account
Host github-company
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_company
  IdentitiesOnly yes
```

> **Key points:**
> - `Host` is an alias you'll use in Git remote URLs
> - `IdentityFile` points to your private key (not the `.pub` file)
> - `IdentitiesOnly yes` ensures only the specified key is used

---

## Step 4: Test SSH Connections

Verify each key works:

```powershell
# Test personal account
ssh -T git@github-personal

# Test company account
ssh -T git@github-company
```

You should see: `Hi <username>! You've successfully authenticated...`

---

## Step 5: Configure a Project to Use a Specific Key

### Option A: New Project (Clone with Alias)

When cloning a new repo, use the host alias instead of `github.com`:

```powershell
# Clone using personal account
git clone git@github-personal:YourUsername/repo-name.git

# Clone using company account
git clone git@github-company:CompanyOrg/repo-name.git
```

### Option B: Existing Project (Change Remote URL)

If the project is already cloned, update the remote URL:

```powershell
# Check current remote
git remote -v

# Change to use personal SSH key
git remote set-url origin git@github-personal:YourUsername/repo-name.git

# Verify the change
git remote -v
```

---

## Step 6: Configure Git User for the Project

**Important:** The SSH key controls *authentication*, but the commit author is controlled by Git's `user.name` and `user.email` settings.

Set these **locally** for the specific project:

```powershell
# Navigate to your project
cd /path/to/your/project

# Set local user config (only affects this project)
git config --local user.name "YourGitHubUsername"
git config --local user.email "your-email@example.com"

# Verify settings
git config --local --list | Select-String "user"
```

> **Note:** Use `--local` to only affect the current repository. Without it, the setting applies globally.

---

## Step 7: Fix Existing Commits (Optional)

If you've already made commits with the wrong author, you can fix the most recent commit:

```powershell
# Amend the last commit with the new author info
git commit --amend --reset-author --no-edit

# Force push to update the remote (use with caution!)
git push --force-with-lease
```

> ⚠️ **Warning:** Only force push if you're the only one working on the branch, or coordinate with your team first.

---

## Quick Reference

| Task | Command |
|------|---------|
| List SSH keys | `Get-ChildItem ~/.ssh` |
| View SSH config | `Get-Content ~/.ssh/config` |
| Test SSH connection | `ssh -T git@<host-alias>` |
| Check current remote | `git remote -v` |
| Change remote URL | `git remote set-url origin <new-url>` |
| Set local Git user | `git config --local user.name "Name"` |
| Set local Git email | `git config --local user.email "email"` |
| View local Git config | `git config --local --list` |

---

## Example: Full Setup for Personal Project

```powershell
# 1. Navigate to project
cd D:\Projects\Personal\my-project

# 2. Set remote to use personal SSH key
git remote set-url origin git@github-personal:MyUsername/my-project.git

# 3. Configure Git user for this project
git config --local user.name "MyUsername"
git config --local user.email "myemail@gmail.com"

# 4. Verify everything
git remote -v
git config --local --list | Select-String "user"
ssh -T git@github-personal

# 5. Ready to push!
git push
```

---

## Troubleshooting

### "Permission denied (publickey)"
- Ensure the SSH key is added to the correct GitHub account
- Check that `IdentityFile` path in SSH config is correct
- Verify the key is loaded: `ssh-add -l`

### Commits showing wrong author
- Set `user.name` and `user.email` locally for the project
- Use `git commit --amend --reset-author` to fix the last commit

### Using HTTPS instead of SSH
- Change remote URL from `https://github.com/...` to `git@<host-alias>:...`
