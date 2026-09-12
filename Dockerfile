FROM node:20-alpine

# Install build dependencies for canvas / native modules if needed
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5001

ENV NODE_ENV=production
ENV PORT=5001

CMD ["npm", "run", "start"]
