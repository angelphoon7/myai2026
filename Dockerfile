#
# Cloud Run backend container (Express webhook)
#
# Builds TypeScript → JS and runs the compiled server.
#

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run backend:build


FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=build /app/dist-backend ./dist-backend

# Cloud Run sets $PORT; app defaults to 8080 locally.
EXPOSE 8080
CMD ["npm", "run", "backend:start"]
