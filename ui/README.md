# This is the User Interface part
...the most important bit.

## Working on it

You should (knowing a bit on front-end / javascript coding) be able to use this separately.
And talk to the ~official API (https://k-web.ismandatory.com/api/v0).

Try this:
In change `const MODE = 'local'` to `const MODE = 'external'`, and then in a terminal:

```sh
cd ui
npm install --global http-server
http-server
# and visit http://localhost:8080 (or whatever port is shown in the output).
```

Or for [livereload](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei):

```sh
npm i -g livereload
http-server & livereload
```

## ObservableHQ example
...or play around with this:
https://observablehq.com/@gorbiz/using-the-k-web-api
