#!/bin/bash
gunicorn --bind 0.0.0.0: api.index:app
