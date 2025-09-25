export default {
	dbURL:
		process.env.MONGO_URL ||
		"mongodb+srv://idanih2_db_user:9UJV8pcITU2kHNVi@cluster0.ui6keev.mongodb.net/",
	dbName: process.env.DB_NAME || "instacat",
}
