# pincenez demo — grading a TDD example transcript
#
# Renders to assets/demo.gif. Re-record with:
#   ANTHROPIC_API_KEY=... vhs assets/demo.tape
#
# Note: this runs pincenez against the live Anthropic API; output will
# differ between recordings due to LLM non-determinism.

Output assets/demo.gif

Set WindowBar Colorful
Set Shell "zsh"
Set FontSize 20
Set FontFamily "Iosevka Term"
Set Width 1200
Set Height 1440
Set Theme "GruvboxDark"
Set TypingSpeed 60ms
Set PlaybackSpeed 1.0

Hide
Type `alias cat='bat --theme gruvbox-dark'`
Enter
Type `alias highlight='bat --theme gruvbox-dark --paging=never --language yaml'`
Enter
Ctrl+L
Show

Sleep 1s
# Show the checks file so viewers know what is being graded.
Type "cat examples/tdd/checks.yaml"
Sleep 1s
Enter 3
Sleep 10s

# Grade the transcript.
Type "pincenez examples/tdd/checks.yaml examples/tdd/transcript.yaml | highlight"
Sleep 2s
Enter
Wait@60s
Sleep 15s
