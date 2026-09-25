{{- define "llm-inference-logging.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "llm-inference-logging.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "llm-inference-logging.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "llm-inference-logging.labels" -}}
app.kubernetes.io/name: {{ include "llm-inference-logging.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "llm-inference-logging.selectorLabels" -}}
app.kubernetes.io/name: {{ include "llm-inference-logging.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "llm-inference-logging.postgres.fullname" -}}
{{- printf "%s-postgres" (include "llm-inference-logging.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "llm-inference-logging.redis.fullname" -}}
{{- printf "%s-redis" (include "llm-inference-logging.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "llm-inference-logging.databaseHost" -}}
{{- if .Values.postgres.enabled -}}
{{- include "llm-inference-logging.postgres.fullname" . -}}
{{- else -}}
{{- required "A database host must be supplied via secrets.databaseUrl when postgres.enabled=false" "" -}}
{{- end -}}
{{- end -}}

{{- define "llm-inference-logging.redisHost" -}}
{{- if .Values.redis.enabled -}}
{{- include "llm-inference-logging.redis.fullname" . -}}
{{- else -}}
{{- required "A redis host must be supplied via secrets.redisUrl when redis.enabled=false" "" -}}
{{- end -}}
{{- end -}}

{{- define "llm-inference-logging.databaseUrl" -}}
{{- if .Values.postgres.enabled -}}
{{- printf "postgresql://%s:%s@%s:%v/%s" .Values.postgres.auth.username .Values.secrets.postgresPassword (include "llm-inference-logging.postgres.fullname" .) .Values.postgres.service.port .Values.postgres.auth.database -}}
{{- else -}}
{{- .Values.secrets.databaseUrl -}}
{{- end -}}
{{- end -}}

{{- define "llm-inference-logging.redisUrl" -}}
{{- if .Values.redis.enabled -}}
{{- printf "redis://%s:%v" (include "llm-inference-logging.redis.fullname" .) .Values.redis.service.port -}}
{{- else -}}
{{- .Values.secrets.redisUrl -}}
{{- end -}}
{{- end -}}
