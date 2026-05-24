import asyncio
from tools import reel


async def main():
    print("FRIDAY ready. Type your command:\n")

    while True:
        user = input("You: ")

        if "idea" in user:
            result = await reel.get_content_ideas("fitness")
            print("\nFRIDAY:\n", result)

        elif "reel" in user:
            job_id = await reel.generate_reel(user)
            print("Generating... Job:", job_id)

            url = await reel.wait_for_reel(job_id)
            print("\nFRIDAY: Your reel is ready:", url)

        else:
            print("FRIDAY: Try asking for a reel or ideas.")


asyncio.run(main())
