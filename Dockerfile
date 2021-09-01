FROM node:16-alpine

WORKDIR /app
ENV NODE_ENV production

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY package*.json ./
RUN npm install

RUN mkdir data
RUN chown node:node data
COPY public /app/public
COPY views /app/views
COPY *.js /app/

USER node
EXPOSE 3000
CMD ["node", "/app/index.js"]
