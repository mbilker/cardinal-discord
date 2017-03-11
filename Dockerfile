FROM node:boron

RUN echo "deb http://www.deb-multimedia.org jessie main non-free" >> /etc/apt/sources.list && apt-get update && apt-get -y --force-yes ffmpeg

RUN mkdir -p /cardinal
WORKDIR /cardinal

COPY package.json /cardinal/
RUN npm install --production

COPY . /cardinal

CMD [ "node", "index.js" ]
