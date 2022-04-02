FROM node:17-alpine

ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG TARGETARCH
ARG TARGETVARIANT
RUN echo "Running on $BUILDPLATFORM, building for $TARGETPLATFORM" > /log

RUN apk update && \
    apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /usr/src/app
# Create the download directory and store it as the 
# default value for the ODM_BASE_PATH environment variable 
RUN mkdir -p /usr/downloads
ENV ODM_BASE_PATH=/usr/downloads

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

EXPOSE 80
CMD [ "npm", "run", "server" ]