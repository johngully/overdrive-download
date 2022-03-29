FROM node:17-alpine

## -- ARM 64 -- 
## The following configuration ensures that puppeteer work on ARM64 devices

# Skip Chromium download as part of npm install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# Install it manually using the native package manager `apk`
RUN apk add --no-cache chromium

## -- ARM 64 --

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