## Structured Streaming OSS Documentation

This is the private repo in which the new Structured Streaming OSS documentation will be developed.

## Developing Locally

1. Clone this repo onto your machine.
2. `cd` into the cloned repository directory.
3. Create virtual environment and enter in: `python3 -m venv env`. And then, `source ./env/bin/activate`
4. Install the dependencies: `pip install -r requirements.txt`
5. Run the server: `mkdocs serve`. That should give you a local URL on which you can view changes.
6. Beware: if your editor auto-formats on save, it might mess up some of the MkDocs directives. I will try to fix this shortly. 
