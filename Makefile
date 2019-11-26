up:
	docker run -d -p 27017-27019:27017-27019 --name mongoose-serialization-proxy-plugin mongo:4
down:
	docker stop mongoose-serialization-proxy-plugin
	docker rm -v mongoose-serialization-proxy-plugin

.PHONY: up down
