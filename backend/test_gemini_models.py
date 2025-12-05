import google.generativeai as genai

genai.configure(api_key="AIzaSyAHQ-Mr8lihG4v3W_BNjbhw7g3KyGm6My8")

print("🔍 Available Models:\n")
for m in genai.list_models():
    print(m.name)
