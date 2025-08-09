REGISTRY = docker.io/petitsinge

build:
	./scripts/build.sh

deploy:
	kubectl apply -k deploy/overlays/minikube/

chaos:
	kubectl create -f k8s/chaos/job-oom-killer.yaml

chaos-demo:
	kubectl apply -f demo/chaos/oom-toggle-job.yaml

delete:
	kubectl delete -k deploy/overlays/minikube/

logs:
	kubectl logs -l app=gateway -n incident-copilot

logs-detective:
	kubectl logs -l app=agent-detective -n incident-copilot

logs-ingestion:
	kubectl logs -l app=ingestion -n incident-copilot

ui:
	kubectl -n incident-copilot port-forward svc/ui 3000:3000 &
	open http://localhost:3000

status:
	kubectl -n incident-copilot get pods
	kubectl -n demo get pods

clean:
	kubectl delete job chaos-oom-killer -n devops-copilot --ignore-not-found
	kubectl delete -f demo/chaos/oom-toggle-job.yaml --ignore-not-found