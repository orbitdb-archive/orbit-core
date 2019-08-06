all: build

deps:
	npm install

test: deps
	rm -rf orbit/
	npm run test
	
build: test
	npm run build
	@echo "Build success!"
	@echo "Output: 'dist/'"

clean:
	rm -rf orbit/
	rm -rf node_modules/
	rm package-lock.json

clean-dependencies: clean
	rm -f package-lock.json;

rebuild: | clean-dependencies build

.PHONY: test
