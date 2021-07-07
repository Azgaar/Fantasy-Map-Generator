FROM nginx:stable-alpine

# Copy the contents of the repo to the container
COPY . /usr/share/nginx/html

# Move the customized nginx config file to the nginx folder
RUN mv /usr/share/nginx/html/.docker/default.conf /etc/nginx/conf.d/default.conf
