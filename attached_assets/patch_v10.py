# patch_v10.py — apply v10 changes
# Usage:
#   1) unzip this zip in your project root
#   2) python patch_v10.py
#   3) pip install -r app/backend/requirements.txt
import os, re, base64

# --- Payloads ---
HR_IMPORT_B64 = "ZnJvbSBmYXN0YXBpIGltcG9ydCBBUElSb3V0ZXIsIERlcGVuZHMsIFVwbG9hZEZpbGUsIEZpbGUsIEhUVFBFeGNlcHRpb24KZnJvbSBzcWxhbGNoZW15Lm9ybSBpbXBvcnQgU2Vzc2lvbgppbXBvcnQgY3N2LCBpbwpmcm9tIGFwcC5kYiBpbXBvcnQgZ2V0X2RiCmZyb20gYXBwLmRlcGVuZGVuY2llc19yb2xlcyBpbXBvcnQgcmVxdWlyZV9yb2xlcwpmcm9tIGFwcC5tb2RlbHMudXNlciBpbXBvcnQgVXNlcgpmcm9tIGFwcC5tb2RlbHMuY2xpZW50IGltcG9ydCBDbGllbnQKZnJvbSBhcHAubW9kZWxzLnRyYWluaW5nIGltcG9ydCBKb2JSb2xlCmZyb20gcGFzc2xpYi5jb250ZXh0IGltcG9ydCBDcnlwdENvbnRleHQKCnJvdXRlciA9IEFQSVJvdXRlcigpCnB3ZF9jdHggPSBDcnlwdENvbnRleHQoc2NoZW1lcz1bImJjcnlwdCJdLCBkZXByZWNhdGVkPSJhdXRvIikKCmRlZiBfcmFuZF9wYXNzd29yZCgpOgogICAgaW1wb3J0IHNlY3JldHMsIHN0cmluZwogICAgY2hhcnMgPSBzdHJpbmcuYXNjaWlfbGV0dGVycyArIHN0cmluZy5kaWdpdHMKICAgIHJldHVybiAiIi5qb2luKHNlY3JldHMuY2hvaWNlKGNoYXJzKSBmb3IgXyBpbiByYW5nZSgxMikpCgpAcm91dGVyLnBvc3QoIi9pbXBvcnQtdXNlcnMiKQphc3luYyBkZWYgaW1wb3J0X3VzZXJzKGZpbGU6IFVwbG9hZEZpbGUgPSBGaWxlKC4uLiksIGRlZmF1bHRfcm9sZTogc3RyID0gIkNhbmRpZGF0ZSIsCiAgICAgICAgICAgICAgICAgICAgICAgZGI6IFNlc3Npb24gPSBEZXBlbmRzKGdldF9kYiksIHVzZXI9RGVwZW5kcyhyZXF1aXJlX3JvbGVzKCdBZG1pbicpKSk6CiAgICBjb250ZW50ID0gYXdhaXQgZmlsZS5yZWFkKCkKICAgIG5hbWUgPSBmaWxlLmZpbGVuYW1lLmxvd2VyKCkKICAgIHJvd3MgPSBbXQogICAgaWYgbmFtZS5lbmRzd2l0aCgiLmNzdiIpOgogICAgICAgIHMgPSBjb250ZW50LmRlY29kZSgidXRmLTgiKTsgcm93cyA9IGxpc3QoY3N2LkRpY3RSZWFkZXIoaW8uU3RyaW5nSU8ocykpKQogICAgZWxpZiBuYW1lLmVuZHN3aXRoKCIueGxzeCIpOgogICAgICAgIGZyb20gb3BlbnB5eGwgaW1wb3J0IGxvYWRfd29ya2Jvb2sKICAgICAgICBpbXBvcnQgdGVtcGZpbGUKICAgICAgICB3aXRoIHRlbXBmaWxlLk5hbWVkVGVtcG9yYXJ5RmlsZShzdWZmaXg9Ii54bHN4IiwgZGVsZXRlPUZhbHNlKSBhcyB0bXA6CiAgICAgICAgICAgIHRtcC53cml0ZShjb250ZW50KTsgdG1wX3BhdGggPSB0bXAubmFtZQogICAgICAgIHdzID0gbG9hZF93b3JrYm9vayh0bXBfcGF0aCkuYWN0aXZlCiAgICAgICAgaGVhZGVycyA9IFtzdHIoYy52YWx1ZSkuc3RyaXAoKS5sb3dlcigpIGZvciBjIGluIG5leHQod3MuaXRlcl9yb3dzKG1pbl9yb3c9MSwgbWF4X3Jvdz0xLCB2YWx1ZXNfb25seT1GYWxzZSkpXQogICAgICAgIGlkeCA9IHtoOmkgZm9yIGksaCBpbiBlbnVtZXJhdGUoaGVhZGVycyl9CiAgICAgICAgZm9yIHIgaW4gd3MuaXRlcl9yb3dzKG1pbl9yb3c9MiwgdmFsdWVzX29ubHk9VHJ1ZSk6CiAgICAgICAgICAgIHJvd3MuYXBwZW5kKHsgaDogcltpXSBmb3IgaCxpIGluIGlkeC5pdGVtcygpIH0pCiAgICBlbHNlOgogICAgICAgIHJhaXNlIEhUVFBFeGNlcHRpb24oNDAwLCAiVXBsb2FkIC5jc3Ygb3IgLnhsc3giKQoKICAgIGNyZWF0ZWQgPSBbXQogICAgZm9yIHJvdyBpbiByb3dzOgogICAgICAgIGVtYWlsID0gKHJvdy5nZXQoImVtYWlsIikgb3IgIiIpLnN0cmlwKCkubG93ZXIoKQogICAgICAgIGlmIG5vdCBlbWFpbDogY29udGludWUKICAgICAgICBmaXJzdCA9IChyb3cuZ2V0KCJmaXJzdF9uYW1lIikgb3IgIiIpLnN0cmlwKCkKICAgICAgICBsYXN0ID0gKHJvdy5nZXQoImxhc3RfbmFtZSIpIG9yICIiKS5zdHJpcCgpCiAgICAgICAgcm9sZSA9IChyb3cuZ2V0KCJyb2xlIikgb3IgZGVmYXVsdF9yb2xlKS5zdHJpcCgpIG9yIGRlZmF1bHRfcm9sZQogICAgICAgIGpyID0gKHJvdy5nZXQoImpvYl9yb2xlIikgb3IgIiIpLnN0cmlwKCkKICAgICAgICBjbGllbnRfbmFtZSA9IChyb3cuZ2V0KCJjbGllbnQiKSBvciAiIikuc3RyaXAoKQogICAgICAgIGlmIGRiLnF1ZXJ5KFVzZXIpLmZpbHRlcihVc2VyLmVtYWlsID09IGVtYWlsKS5maXJzdCgpOgogICAgICAgICAgICBjb250aW51ZQogICAgICAgIGpvYl9yb2xlX2lkID0gTm9uZQogICAgICAgIGlmIGpyOgogICAgICAgICAgICBqID0gZGIucXVlcnkoSm9iUm9sZSkuZmlsdGVyX2J5KG5hbWU9anIpLmZpcnN0KCkKICAgICAgICAgICAgaWYgbm90IGo6IAogICAgICAgICAgICAgICAgaiA9IEpvYlJvbGUobmFtZT1qcik7IGRiLmFkZChqKTsgZGIuZmx1c2goKQogICAgICAgICAgICBqb2Jfcm9sZV9pZCA9IGouaWQKICAgICAgICBjbGllbnRfaWQgPSBOb25lCiAgICAgICAgaWYgY2xpZW50X25hbWU6CiAgICAgICAgICAgIGMgPSBkYi5xdWVyeShDbGllbnQpLmZpbHRlcl9ieShuYW1lPWNsaWVudF9uYW1lKS5maXJzdCgpCiAgICAgICAgICAgIGlmIG5vdCBjOiAKICAgICAgICAgICAgICAgIGMgPSBDbGllbnQobmFtZT1jbGllbnRfbmFtZSk7IGRiLmFkZChjKTsgZGIuZmx1c2goKQogICAgICAgICAgICBjbGllbnRfaWQgPSBjLmlkCiAgICAgICAgdGVtcF9wd2QgPSBfcmFuZF9wYXNzd29yZCgpCiAgICAgICAgcHdkX2hhc2ggPSBwd2RfY3R4Lmhhc2godGVtcF9wd2QpCiAgICAgICAgdSA9IFVzZXIoZW1haWw9ZW1haWwsIGZpcnN0X25hbWU9Zmlyc3QsIGxhc3RfbmFtZT1sYXN0LCByb2xlPXJvbGUsIHBhc3N3b3JkX2hhc2g9cHdkX2hhc2gsCiAgICAgICAgICAgICAgICAgam9iX3JvbGVfaWQ9am9iX3JvbGVfaWQsIGNsaWVudF9pZD1jbGllbnRfaWQpCiAgICAgICAgZGIuYWRkKHUpOyBkYi5mbHVzaCgpCiAgICAgICAgY3JlYXRlZC5hcHBlbmQoeyJlbWFpbCI6IGVtYWlsLCAidGVtcF9wYXNzd29yZCI6IHRlbXBfcHdkLCAidXNlcl9pZCI6IHUuaWR9KQogICAgZGIuY29tbWl0KCkKICAgIHJldHVybiB7ImNyZWF0ZWQiOiBjcmVhdGVkLCAiY291bnQiOiBsZW4oY3JlYXRlZCl9"
LIST_RECORDS_B64 = "QHJvdXRlci5nZXQoIi9yZWNvcmRzIikKZGVmIGxpc3RfcmVjb3Jkcyh1c2VyX2lkOiBpbnQgfCBOb25lID0gTm9uZSwgZGI6IFNlc3Npb24gPSBEZXBlbmRzKGdldF9kYiksIHVzZXI9RGVwZW5kcyhnZXRfY3VycmVudF91c2VyKSk6CiAgICBmcm9tIGRhdGV0aW1lIGltcG9ydCBkYXRlCiAgICB0YXJnZXRfaWQgPSB1c2VyX2lkIG9yIHVzZXIuaWQKICAgIGlmIHRhcmdldF9pZCAhPSB1c2VyLmlkOgogICAgICAgIGZyb20gYXBwLmRlcGVuZGVuY2llc19yb2xlcyBpbXBvcnQgcmVxdWlyZV9yb2xlcyBhcyByZXFyCiAgICAgICAgcmVxcignQWRtaW4nLCdNYW5hZ2VyJykodXNlcikKICAgIHJlY3MgPSBkYi5xdWVyeShUcmFpbmluZ1JlY29yZCkuZmlsdGVyKFRyYWluaW5nUmVjb3JkLnVzZXJfaWQgPT0gdGFyZ2V0X2lkKS5hbGwoKQogICAgb3V0ID0gW10KICAgIGZvciByIGluIHJlY3M6CiAgICAgICAgYyA9IGRiLnF1ZXJ5KFRyYWluaW5nQ291cnNlKS5nZXQoci50cmFpbmluZ19pZCkKICAgICAgICB0b2RheSA9IGRhdGUudG9kYXkoKQogICAgICAgIHN0YXR1cyA9ICJ1bmtub3duIgogICAgICAgIGlmIHIuZXhwaXJ5X2RhdGU6CiAgICAgICAgICAgIGlmIHIuZXhwaXJ5X2RhdGUgPCB0b2RheTogc3RhdHVzID0gInJlZCIKICAgICAgICAgICAgZWxpZiAoci5leHBpcnlfZGF0ZSAtIHRvZGF5KS5kYXlzIDw9IDkwOiBzdGF0dXMgPSAiYW1iZXIiCiAgICAgICAgICAgIGVsc2U6IHN0YXR1cyA9ICJncmVlbiIKICAgICAgICBvdXQuYXBwZW5kKHsKICAgICAgICAgICAgImlkIjogci5pZCwgInRyYWluaW5nX2lkIjogci50cmFpbmluZ19pZCwgInRyYWluaW5nX25hbWUiOiBjLm5hbWUgaWYgYyBlbHNlIGYiI3tyLnRyYWluaW5nX2lkfSIsCiAgICAgICAgICAgICJhY2hpZXZlbWVudF9kYXRlIjogc3RyKHIuYWNoaWV2ZW1lbnRfZGF0ZSkgaWYgci5hY2hpZXZlbWVudF9kYXRlIGVsc2UgTm9uZSwKICAgICAgICAgICAgImV4cGlyeV9kYXRlIjogc3RyKHIuZXhwaXJ5X2RhdGUpIGlmIHIuZXhwaXJ5X2RhdGUgZWxzZSBOb25lLAogICAgICAgICAgICAiY2VydGlmaWNhdGVfcGF0aCI6IHIuY2VydGlmaWNhdGVfcGF0aCwgInN0YXR1cyI6IHN0YXR1cwogICAgICAgIH0pCiAgICByZXR1cm4geyJyZWNvcmRzIjogb3V0fQ=="
MY_TRAINING_B64 = "aW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSB9IGZyb20gJ3JlYWN0JwppbXBvcnQgeyBhcGkgfSBmcm9tICcuLi9saWIvYXBpJwoKdHlwZSBSZWMgPSB7IGlkOm51bWJlcjsgdHJhaW5pbmdfaWQ6bnVtYmVyOyB0cmFpbmluZ19uYW1lOnN0cmluZzsgYWNoaWV2ZW1lbnRfZGF0ZT86c3RyaW5nfG51bGw7IGV4cGlyeV9kYXRlPzpzdHJpbmd8bnVsbDsgY2VydGlmaWNhdGVfcGF0aD86c3RyaW5nOyBzdGF0dXM6J2dyZWVuJ3wnYW1iZXInfCdyZWQnfCd1bmtub3duJyB9CgpleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBNeVRyYWluaW5nKCl7CiAgY29uc3QgW3JlY29yZHMsIHNldFJlY29yZHNdID0gdXNlU3RhdGU8UmVjW10+KFtdKQogIGNvbnN0IFtwZW5kaW5nLCBzZXRQZW5kaW5nXSA9IHVzZVN0YXRlPG51bWJlcnxudWxsPihudWxsKQogIGNvbnN0IFtkYXRlcywgc2V0RGF0ZXNdID0gdXNlU3RhdGU8UmVjb3JkPHN0cmluZyxzdHJpbmc+Pih7fSkKCiAgY29uc3QgbG9hZCA9IGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHJlcyA9IGF3YWl0IGFwaS5nZXQoJy90cmFpbmluZy9yZWNvcmRzJykKICAgIHNldFJlY29yZHMocmVzLmRhdGEucmVjb3JkcykKICB9CiAgdXNlRWZmZWN0KCgpPT57IGxvYWQoKSB9LCBbXSkKCiAgY29uc3QgYmFkZ2UgPSAoczonZ3JlZW4nfCdhbWJlcid8J3JlZCd8J3Vua25vd24nKSA9PiB7CiAgICBjb25zdCBjbHMgPSBzPT09J2dyZWVuJz8nYmctZ3JlZW4tMTAwIHRleHQtZ3JlZW4tODAwJzpzPT09J2FtYmVyJz8nYmcteWVsbG93LTEwMCB0ZXh0LXllbGxvdy04MDAnOnM9PT0ncmVkJz8nYmctcmVkLTEwMCB0ZXh0LXJlZC04MDAnOidiZy1uZXV0cmFsLTEwMCB0ZXh0LW5ldXRyYWwtNzAwJwogICAgY29uc3QgdHh0ID0gcz09PSdncmVlbic/J0luIGRhdGUnOnM9PT0nYW1iZXInPydEdWUgPD05MGQnOnM9PT0ncmVkJz8nRXhwaXJlZCc6J1Vua25vd24nCiAgICByZXR1cm4gPHNwYW4gY2xhc3NOYW1lPXtgcHgtMiBweS0wLjUgcm91bmRlZCB0ZXh0LXhzICR7Y2xzfWB9Pnt0eHR9PC9zcGFuPgogIH0KCiAgY29uc3QgdXBsb2FkID0gYXN5bmMgKGlkOm51bWJlciwgZmlsZTpGaWxlKSA9PiB7CiAgICBzZXRQZW5kaW5nKGlkKQogICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpOyBmb3JtLmFwcGVuZCgnZmlsZScsIGZpbGUpCiAgICBhd2FpdCBhcGkucG9zdChgL3RyYWluaW5nL3JlY29yZHMvJHtpZH0vY2VydGlmaWNhdGVgLCBmb3JtLCB7IGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6J211bHRpcGFydC9mb3JtLWRhdGEnIH0gfSkKICAgIHNldFBlbmRpbmcobnVsbCk7IGF3YWl0IGxvYWQoKQogIH0KCiAgY29uc3Qgc2F2ZURhdGVzID0gYXN5bmMgKGlkOm51bWJlcikgPT4gewogICAgY29uc3QgYSA9IGRhdGVzW2BhXyR7aWR9YF07IGNvbnN0IGUgPSBkYXRlc1tgZV8ke2lkfWBdCiAgICBhd2FpdCBhcGkucG9zdChgL3RyYWluaW5nL3JlY29yZHMvJHtpZH0vZGF0ZXNgLCBudWxsLCB7IHBhcmFtczogeyBhY2hpZXZlbWVudF9kYXRlOiBhIHx8IG51bGwsIGV4cGlyeV9kYXRlOiBlIHx8IG51bGwgfSB9KQogICAgYXdhaXQgbG9hZCgpCiAgfQoKICByZXR1cm4gKAogICAgPGRpdiBjbGFzc05hbWU9InNwYWNlLXktNCI+CiAgICAgIDxoMSBjbGFzc05hbWU9InRleHQtMnhsIGZvbnQtYm9sZCI+TXkgVHJhaW5pbmc8L2gxPgogICAgICA8dGFibGUgY2xhc3NOYW1lPSJtaW4tdy1mdWxsIGJvcmRlciI+CiAgICAgICAgPHRoZWFkIGNsYXNzTmFtZT0iYmctbmV1dHJhbC01MCI+CiAgICAgICAgICA8dHI+CiAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9InAtMiBib3JkZXIgdGV4dC1sZWZ0Ij5UcmFpbmluZzwvdGg+CiAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9InAtMiBib3JkZXIiPlN0YXR1czwvdGg+CiAgICAgICAgICAgIDx0aCBjbGFzc05hbWU9InAtMiBib3JkZXIiPkFjaGlldmVtZW50PC90aD4KICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT0icC0yIGJvcmRlciI+RXhwaXJ5PC90aD4KICAgICAgICAgICAgPHRoIGNsYXNzTmFtZT0icC0yIGJvcmRlciI+Q2VydGlmaWNhdGU8L3RoPgogICAgICAgICAgICA8dGggY2xhc3NOYW1lPSJwLTIgYm9yZGVyIj5BY3Rpb25zPC90aD4KICAgICAgICAgIDwvdHI+CiAgICAgICAgPC90aGVhZD4KICAgICAgICA8dGJvZHk+CiAgICAgICAgICB7cmVjb3Jkcy5tYXAociA9PiAoCiAgICAgICAgICAgIDx0ciBrZXk9e3IuaWR9PgogICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9InAtMiBib3JkZXIiPntyLnRyYWluaW5nX25hbWV9PC90ZD4KICAgICAgICAgICAgICA8dGQgY2xhc3NOYW1lPSJwLTIgYm9yZGVyIHRleHQtY2VudGVyIj57YmFkZ2Uoci5zdGF0dXMpfTwvdGQ+CiAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT0icC0yIGJvcmRlciI+PGlucHV0IHR5cGU9ImRhdGUiIGNsYXNzTmFtZT0iYm9yZGVyIHAtMSByb3VuZGVkIiBkZWZhdWx0VmFsdWU9e3IuYWNoaWV2ZW1lbnRfZGF0ZSB8fCAnJ30gb25DaGFuZ2U9e2U9PnNldERhdGVzKHsuLi5kYXRlcywgW2BhXyR7ci5pZH1gXTogZS50YXJnZXQudmFsdWV9KX0gLz48L3RkPgogICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9InAtMiBib3JkZXIiPjxpbnB1dCB0eXBlPSJkYXRlIiBjbGFzc05hbWU9ImJvcmRlciBwLTEgcm91bmRlZCIgZGVmYXVsdFZhbHVlPXtyLmV4cGlyeV9kYXRlIHx8ICcnfSBvbkNoYW5nZT17ZT0+c2V0RGF0ZXMoey4uLmRhdGVzLCBbYGVfJHtyLmlkfWBdOiBlLnRhcmdldC52YWx1ZX0pfSAvPjwvdGQ+CiAgICAgICAgICAgICAgPHRkIGNsYXNzTmFtZT0icC0yIGJvcmRlciI+CiAgICAgICAgICAgICAgICB7ci5jZXJ0aWZpY2F0ZV9wYXRoID8gPGEgaHJlZj17YCR7YXBpLmRlZmF1bHRzLmJhc2VVUkx9JHtyLmNlcnRpZmljYXRlX3BhdGh9YH0gY2xhc3NOYW1lPSJ1bmRlcmxpbmUgdGV4dC1zbSIgdGFyZ2V0PSJfYmxhbmsiPlZpZXc8L2E+IDogPHNwYW4gY2xhc3NOYW1lPSJ0ZXh0LXhzIHRleHQtbmV1dHJhbC01MDAiPk5vbmU8L3NwYW4+fQogICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9ImZpbGUiIGFjY2VwdD0iLnBkZixpbWFnZS8qIiBjbGFzc05hbWU9ImJsb2NrIG10LTEgdGV4dC14cyIgb25DaGFuZ2U9e2U9PnsgY29uc3QgZj1lLnRhcmdldC5maWxlcz8uWzBdOyBpZihmKSB1cGxvYWQoci5pZCwgZikgfX0gLz4KICAgICAgICAgICAgICAgIHtwZW5kaW5nPT09ci5pZCAmJiA8ZGl2IGNsYXNzTmFtZT0idGV4dC14cyB0ZXh0LW5ldXRyYWwtNTAwIG10LTEiPlVwbG9hZGluZy4uLjwvZGl2Pn0KICAgICAgICAgICAgICA8L3RkPgogICAgICAgICAgICAgIDx0ZCBjbGFzc05hbWU9InAtMiBib3JkZXIgdGV4dC1jZW50ZXIiPgogICAgICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKT0+c2F2ZURhdGVzKHIuaWQpfSBjbGFzc05hbWU9InB4LTIgcHktMSBib3JkZXIgcm91bmRlZCB0ZXh0LXNtIj5TYXZlPC9idXR0b24+CiAgICAgICAgICAgICAgPC90ZD4KICAgICAgICAgICAgPC90cj4KICAgICAgICAgICkpfQogICAgICAgIDwvdGJvZHk+CiAgICAgIDwvdGFibGU+CiAgICA8L2Rpdj4KICApCn0="

def dec(b): return base64.b64decode(b).decode("utf-8")

def read(p):
    with open(p, "r", encoding="utf-8") as f: return f.read()

def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f: f.write(s)

def add_req(pkg):
    reqp = "app/backend/requirements.txt"
    if os.path.exists(reqp):
        with open(reqp, "r", encoding="utf-8") as f: txt = f.read()
        if pkg not in txt:
            with open(reqp, "a", encoding="utf-8") as f: f.write("\n"+pkg+"\n")

def main():
    # Backend file
    write("app/backend/app/api/hr_import.py", dec(HR_IMPORT_B64))

    # Wire router
    mp = "app/backend/app/main.py"
    s = read(mp)
    if "hr_import" not in s:
        s = s.replace(
            "from app.api import assessment_pdf, template_import, clients, template_builder, training",
            "from app.api import assessment_pdf, template_import, clients, template_builder, training, hr_import"
        )
        s = s.replace(
            "app.include_router(training.router, prefix=\"/training\", tags=[\"training\"])",
            "app.include_router(training.router, prefix=\"/training\", tags=[\"training\"])\\napp.include_router(hr_import.router, prefix=\"/hr\", tags=[\"hr\"])"
        )
        write(mp, s)

    # Add /training/records
    tp = "app/backend/app/api/training.py"
    s = read(tp)
    if "def list_records(" not in s:
        s = s + "\n" + dec(LIST_RECORDS_B64) + "\n"
        write(tp, s)

    # Requirements
    add_req("passlib[bcrypt]")
    add_req("python-dateutil")

    # Frontend page
    write("app/frontend/src/pages/MyTraining.tsx", dec(MY_TRAINING_B64))

    # Protected with roles
    app = "app/frontend/src/App.tsx"
    s = read(app)
    s = s.replace("import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'",
                  "import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'")
    s = s.replace("function Protected({ children }: { children: React.ReactNode }) {",
                  "function Protected({ children, roles }: { children: React.ReactNode, roles?: string[] }) {")
    s = s.replace("  if (loading) return <div className=\\\"p-6\\\">Loading…</div>\\n  if (!user) return <Navigate to=\\\"/login\\\" replace />\\n  return <>{children}</>",
                  "  if (loading) return <div className=\\\"p-6\\\">Loading...</div>\\n  if (!user) return <Navigate to=\\\"/login\\\" replace />\\n  if (roles && !roles.includes(user.role)) return <div className=\\\"p-6\\\">You don’t have access to this area.</div>\\n  return <>{children}</>")
    s = s.replace('<Route path=\"/verify\" element={<Protected><Verify /></Protected>} />','<Route path=\"/verify\" element={<Protected roles={[\\'Verifier\\',\\'Admin\\']}><Verify /></Protected>} />')
    s = s.replace('<Route path=\"/reports\" element={<Protected><Reports /></Protected>} />','<Route path=\"/reports\" element={<Protected roles={[\\'Admin\\',\\'Manager\\']}><Reports /></Protected>} />')
    s = s.replace('<Route path=\"/clients\" element={<Protected><Clients /></Protected>} />','<Route path=\"/clients\" element={<Protected roles={[\\'Admin\\']}><Clients /></Protected>} />')
    s = s.replace('<Route path=\"/training/admin\" element={<Protected><TrainingAdmin /></Protected>} />','<Route path=\"/training/admin\" element={<Protected roles={[\\'Admin\\',\\'Manager\\']}><TrainingAdmin /></Protected>} />')
    write(app, s)

    # Label sweep
    for dp, dn, files in os.walk("app/frontend/src"):
        for f in files:
            if f.endswith((".tsx",".ts",".jsx",".js")):
                p = os.path.join(dp, f)
                with open(p, "r", encoding="utf-8") as fh:
                    t = fh.read()
                import re
                t = t.replace("Skills Gap","Training Gap").replace("Skills gap","Training gap").replace("skills gap","training gap")
                t = re.sub(r'\\bSkills\\b','Training',t)
                t = re.sub(r'\\bskills\\b','training',t)
                t = re.sub(r'\\bSkill\\b','Training',t)
                t = re.sub(r'\\bskill\\b','training',t)
                with open(p, "w", encoding="utf-8") as fh:
                    fh.write(t)

    print("Patch v10 applied. Install backend requirements and rebuild the frontend.")

if __name__ == "__main__":
    main()
