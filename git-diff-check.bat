@echo off
cd /d C:\Users\Artur\.vscode\esports-tournament-system
echo === GIT STATUS ===
git --no-pager status
echo.
echo === GIT DIFF ===
git --no-pager diff backend/src/tournaments/tournaments.service.ts backend/src/tournaments/tournaments.controller.ts backend/src/tournaments/tournaments.service.spec.ts frontend/package.json frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css frontend/src/App.css frontend/src/types/tournament.ts frontend/src/api/client.ts frontend/src/api/tournaments.ts frontend/src/components/layout/ShellLayout.tsx frontend/src/components/bracket/PlayoffBracket.tsx frontend/src/components/groups/GroupTables.tsx frontend/src/pages/HomePage.tsx frontend/src/pages/GenerationPage.tsx frontend/src/pages/SimulationPage.tsx
