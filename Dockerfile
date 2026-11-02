FROM node:24@sha256:8530f76a96d88820d288761f022e318970dda93d01536919fbc16076b7983e63 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN yarn --frozen-lockfile --network-timeout 600000

ARG NODE_ENV=production

RUN yarn --cwd ./synapdraw-app cross-env VITE_APP_DISABLE_SENTRY=true vite build --mode ${NODE_ENV}

FROM nginx:stable-alpine-slim@sha256:2c605dbeab79a6b2a63340474fe58119d0ef95bdc4b1f41df0aa689659b3d13b

COPY --from=build /opt/node_app/synapdraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
