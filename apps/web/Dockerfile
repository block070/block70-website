# Block70 Web — minimal Dockerfile for docker-compose
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ARG API_SERVER_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV API_SERVER_URL=$API_SERVER_URL
# Generate the Prisma client before `next build` so model types resolve during
# tsc. Without this step, `@prisma/client` is an ungenerated stub and any route
# that calls `prisma.<model>.*` trips `noImplicitAny` during the build.
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production
CMD ["npm", "start"]
