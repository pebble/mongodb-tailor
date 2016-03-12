ENV_VARS := \
	NODE_ENV=test

test: mocha lint

mocha:
	@ $(ENV_VARS) ./node_modules/.bin/mocha $(MOCHA_OPTS)

lint:
	@ find . -name "*.js" \
		-not -path "./node_modules/*" \
		-not -path "./coverage/*" -print0 | \
		xargs -0 ./node_modules/eslint/bin/eslint.js

test-cov:
	@ $(ENV_VARS) node $(V8_OPTIONS) \
		node_modules/.bin/istanbul cover \
		./node_modules/.bin/_mocha \
		-- --recursive $(MOCHA_OPTS)

open-cov:
	open coverage/lcov-report/index.html

.PHONY: test mocha lint test-cov open-cov
