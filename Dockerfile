FROM nginx:alpine
# la page du jeu est revérifiée à chaque visite (sinon Safari garde l'ancienne version)
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { add_header Cache-Control no-cache; }\n}\n' > /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
