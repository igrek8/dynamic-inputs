# Last line containing parsable JSON will be available in the selection list

# Simple labels
echo '["A", "B", "C"]'

# Labels with icons
# https://code.visualstudio.com/api/references/icons-in-labels
echo '[ { "label": "$(notebook-state-success) A", "value": "A", "picked": true }, { "label": "$(notebook-state-error) B", "value": "B" }, { "label": "$(notifications-configure) C", "value": "C" } ]'
