from workflow_state import get_state_manager

# Get the most recent workflow
state_manager = get_state_manager()
workflows = list(state_manager._active_workflows.values())

if workflows:
    latest = max(workflows, key=lambda w: w.get("created_at", ""))
    print("🎯 Latest Workflow ID:", latest["workflow_id"])
    print("📋 Tasks Content:")
    print("=" * 80)
    
    if "tasks_content" in latest and latest["tasks_content"]:
        print(latest["tasks_content"])
    else:
        print("No tasks content found. Available keys:")
        print(list(latest.keys()))
        
    print("=" * 80)
    print(f"Content length: {len(latest.get('tasks_content', ''))} characters")
else:
    print("No workflows found")
