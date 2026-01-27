# Deployment Workflow

// turbo-all

## Quick Deploy (All)

```bash
firebase deploy
```

## Selective Deploy

### Functions Only (AI logic changes)

```bash
firebase deploy --only functions
```

### Hosting Only (UI changes)

```bash
firebase deploy --only hosting
```

### Firestore Rules Only

```bash
firebase deploy --only firestore:rules
```

## Pre-Deploy Checklist

1. **Bump version** in `ui/index.html` or relevant file (e.g., `v1.2.3`)
2. Run `git status` - ensure all changes committed
3. Run `git push` - backup to GitHub first
4. Deploy with `firebase deploy` (deploys ALL: hosting + functions + rules)

## Post-Deploy Verification

1. Check <https://ue5-learning-paths.web.app/>
2. Open DevTools Console
3. Generate a learning path
4. Verify `[API] Cloud Function SUCCESS` appears
5. Check version number matches what you deployed
