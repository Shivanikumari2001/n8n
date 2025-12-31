# Use the latest official n8n image with AI Agent + LangChain features
FROM n8nio/n8n:latest

USER root

ENV NODE_ENV=development

RUN npm install -g typescript gulp rimraf

ENV N8N_CUSTOM_EXTENSIONS="/home/node/n8n-custom-nodes"
RUN mkdir -p $N8N_CUSTOM_EXTENSIONS/node_modules

COPY n8n-nodes-starter/ $N8N_CUSTOM_EXTENSIONS/node_modules/n8n-nodes-starter

RUN cd $N8N_CUSTOM_EXTENSIONS/node_modules/n8n-nodes-starter && \
npm install && \
npm run build && \
ls -la dist/

USER node