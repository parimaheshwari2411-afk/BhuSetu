# BhuSetu — Land Title Registry

React + Vite + Tailwind CSS frontend with a Node/Express API, PostGIS, IPFS, and a multi-sig escrow contract.

## Development

- Frontend: `npm run dev` (Vite, default port 5173). `/api` is proxied to `http://127.0.0.1:3000`.
- Backend: `cd backend && npm run dev` (Express on port 3000).

## Project structure

- `src/` — React UI (`App.tsx` is the shell)
- `backend/` — Express TypeScript API under `/api/v1`
- `contracts/` — `LandTitleEscrow.sol` and Hardhat deploy scripts
- `migrations/` — PostgreSQL + PostGIS SQL

Use double quotes for strings containing apostrophes. Export React components as default exports.
