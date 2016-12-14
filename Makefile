all: build

deps:
	npm install

test: deps
	rm -rf orbit/
	npm run test
	
build: test
	npm run build
	cp dist/orbit.min.js examples/browser/lib
	cp node_modules/@haad/ipfs-api/dist/index.min.js examples/browser/lib/ipfs-api.min.js
	@echo "Build success!"
	@echo "Output: 'dist/'"

clean:
	rm -rf orbit/
	rm -rf node_modules/

.PHONY: test
