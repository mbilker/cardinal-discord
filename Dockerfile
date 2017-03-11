FROM nodejs:argon

RUN mkdir -p /cardinal
WORKDIR /cardinal

COPY package.json /cardinal/
RUN npm install --production

COPY . /cardinal

CMD [ "node", "index.js" ]
