# To install pnpm

```
Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression
```

# To run the project

```
pnpm install
pnpm start
```

# Alternatively, you can run the backend and frontend in separate terminals:

# Terminal 1

```
pnpm --filter backend dev
```

# Terminal 2

```
pnpm --filter frontend dev
```
