#!/bin/sh
[ "$1" = agy-launch ] || exit 1
case "$2" in
  fail) exit 1 ;;
  stall) exec sleep 10 ;;
  malformed) printf 'bad output\n'; exit 0 ;;
  gemini-4-neon-low) printf 'gemini-4-neon\thigh\n' ;;
  gemini-4-hydrogen-low) printf 'gemini-4-hydrogen\t%s\n' "$3" ;;
  *) printf '%s\t%s\n' "$2" "$3" ;;
esac
